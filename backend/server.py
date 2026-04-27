from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import logging
import secrets
import uuid
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("rentcar")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
ACCESS_TTL_MIN = 60 * 24  # 1 day for ease of use
REFRESH_TTL_DAYS = 7

app = FastAPI(title="RentaFlow API")
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(payload: dict, ttl: timedelta) -> str:
    p = payload.copy()
    p["exp"] = datetime.now(timezone.utc) + ttl
    return jwt.encode(p, JWT_SECRET, algorithm=JWT_ALGO)


def set_auth_cookies(response: Response, user_id: str, email: str):
    access = create_token({"sub": user_id, "email": email, "type": "access"}, timedelta(minutes=ACCESS_TTL_MIN))
    refresh = create_token({"sub": user_id, "type": "refresh"}, timedelta(days=REFRESH_TTL_DAYS))
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax",
                        max_age=ACCESS_TTL_MIN * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax",
                        max_age=REFRESH_TTL_DAYS * 24 * 3600, path="/")
    return access


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "No autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(401, "Token inválido")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo administradores")
    return user


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_date(d) -> date:
    if isinstance(d, date) and not isinstance(d, datetime):
        return d
    if isinstance(d, datetime):
        return d.date()
    return datetime.fromisoformat(str(d)).date()


def days_between(a, b) -> int:
    da, db_ = parse_date(a), parse_date(b)
    return max(1, (db_ - da).days)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "staff"] = "staff"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class VehicleIn(BaseModel):
    name: str
    license_plate: str
    category: Literal["economico", "compacto", "suv", "lujo", "van", "deportivo"] = "economico"
    daily_price: float
    status: Literal["disponible", "alquilado", "mantenimiento"] = "disponible"
    image_url: Optional[str] = None
    notes: Optional[str] = None


class CustomerIn(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    identification: Optional[str] = None
    notes: Optional[str] = None


class ReservationIn(BaseModel):
    customer_id: str
    vehicle_id: str
    pickup_date: str  # ISO date YYYY-MM-DD
    return_date: str
    total_price: Optional[float] = None
    payment_status: Literal["pendiente", "parcial", "pagado"] = "pendiente"
    status: Literal["pendiente", "confirmada", "en_curso", "completada", "cancelada"] = "pendiente"
    notes: Optional[str] = None


class PaymentIn(BaseModel):
    reservation_id: str
    amount: float
    method: Literal["efectivo", "transferencia", "tarjeta"] = "efectivo"
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "El correo ya está registrado")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": data.name,
        "role": data.role,
        "password_hash": hash_password(data.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    set_auth_cookies(response, user["id"], email)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return user


@api.post("/auth/login")
async def login(data: LoginIn, response: Response, request: Request):
    email = data.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= 5:
        locked_until = rec.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(429, "Demasiados intentos. Intenta más tarde.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1},
             "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(401, "Credenciales inválidas")

    await db.login_attempts.delete_one({"identifier": identifier})
    set_auth_cookies(response, user["id"], email)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return user


@api.post("/auth/logout")
async def logout(response: Response, _user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# Vehicles
# ---------------------------------------------------------------------------
@api.get("/vehicles")
async def list_vehicles(
    user: dict = Depends(get_current_user),
    q: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"license_plate": {"$regex": q, "$options": "i"}},
        ]
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    items = await db.vehicles.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api.post("/vehicles")
async def create_vehicle(data: VehicleIn, user: dict = Depends(get_current_user)):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    if await db.vehicles.find_one({"license_plate": doc["license_plate"]}):
        raise HTTPException(400, "La placa ya existe")
    await db.vehicles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/vehicles/{vid}")
async def update_vehicle(vid: str, data: VehicleIn, user: dict = Depends(get_current_user)):
    upd = data.model_dump()
    res = await db.vehicles.update_one({"id": vid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Vehículo no encontrado")
    doc = await db.vehicles.find_one({"id": vid}, {"_id": 0})
    return doc


@api.delete("/vehicles/{vid}")
async def delete_vehicle(vid: str, user: dict = Depends(require_admin)):
    if await db.reservations.find_one({"vehicle_id": vid, "status": {"$in": ["pendiente", "confirmada", "en_curso"]}}):
        raise HTTPException(400, "Vehículo tiene reservas activas")
    await db.vehicles.delete_one({"id": vid})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
@api.get("/customers")
async def list_customers(user: dict = Depends(get_current_user), q: Optional[str] = None):
    query = {}
    if q:
        query["$or"] = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"identification": {"$regex": q, "$options": "i"}},
        ]
    items = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api.get("/customers/{cid}")
async def get_customer(cid: str, user: dict = Depends(get_current_user)):
    cust = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Cliente no encontrado")
    history = await db.reservations.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"customer": cust, "history": history}


@api.post("/customers")
async def create_customer(data: CustomerIn, user: dict = Depends(get_current_user)):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/customers/{cid}")
async def update_customer(cid: str, data: CustomerIn, user: dict = Depends(get_current_user)):
    res = await db.customers.update_one({"id": cid}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Cliente no encontrado")
    return await db.customers.find_one({"id": cid}, {"_id": 0})


@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user: dict = Depends(require_admin)):
    if await db.reservations.find_one({"customer_id": cid}):
        raise HTTPException(400, "Cliente tiene reservas asociadas")
    await db.customers.delete_one({"id": cid})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Reservations
# ---------------------------------------------------------------------------
async def check_overlap(vehicle_id: str, pickup: str, ret: str, exclude_id: Optional[str] = None) -> bool:
    p, r = parse_date(pickup), parse_date(ret)
    query = {
        "vehicle_id": vehicle_id,
        "status": {"$in": ["pendiente", "confirmada", "en_curso"]},
    }
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    existing = await db.reservations.find(query, {"_id": 0}).to_list(1000)
    for ex in existing:
        ep, er = parse_date(ex["pickup_date"]), parse_date(ex["return_date"])
        if not (r <= ep or p >= er):
            return True
    return False


async def gen_reservation_number() -> str:
    count = await db.reservations.count_documents({})
    return f"RES-{datetime.now().year}-{count + 1:05d}"


@api.get("/reservations")
async def list_reservations(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    q: Optional[str] = None,
):
    query = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    if q:
        query["reservation_number"] = {"$regex": q, "$options": "i"}
    items = await db.reservations.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # enrich with customer & vehicle name
    cust_ids = {x["customer_id"] for x in items}
    veh_ids = {x["vehicle_id"] for x in items}
    custs = {c["id"]: c async for c in db.customers.find({"id": {"$in": list(cust_ids)}}, {"_id": 0})}
    vehs = {v["id"]: v async for v in db.vehicles.find({"id": {"$in": list(veh_ids)}}, {"_id": 0})}
    for it in items:
        c = custs.get(it["customer_id"])
        v = vehs.get(it["vehicle_id"])
        it["customer_name"] = c.get("full_name") if c else "—"
        it["vehicle_name"] = f"{v.get('name')} ({v.get('license_plate')})" if v else "—"
    return items


@api.post("/reservations")
async def create_reservation(data: ReservationIn, user: dict = Depends(get_current_user)):
    cust = await db.customers.find_one({"id": data.customer_id})
    if not cust:
        raise HTTPException(404, "Cliente no encontrado")
    veh = await db.vehicles.find_one({"id": data.vehicle_id})
    if not veh:
        raise HTTPException(404, "Vehículo no encontrado")

    if await check_overlap(data.vehicle_id, data.pickup_date, data.return_date):
        raise HTTPException(400, "El vehículo no está disponible en esas fechas")

    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["reservation_number"] = await gen_reservation_number()
    doc["created_at"] = now_iso()
    doc["created_by"] = user["id"]
    if not doc.get("total_price"):
        d = days_between(data.pickup_date, data.return_date)
        doc["total_price"] = round(d * float(veh["daily_price"]), 2)
    doc["paid_amount"] = 0.0
    await db.reservations.insert_one(doc)

    # update vehicle status if reservation is current
    today = date.today()
    if parse_date(data.pickup_date) <= today <= parse_date(data.return_date):
        await db.vehicles.update_one({"id": data.vehicle_id}, {"$set": {"status": "alquilado"}})

    doc.pop("_id", None)
    return doc


@api.put("/reservations/{rid}")
async def update_reservation(rid: str, data: ReservationIn, user: dict = Depends(get_current_user)):
    existing = await db.reservations.find_one({"id": rid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Reserva no encontrada")
    if await check_overlap(data.vehicle_id, data.pickup_date, data.return_date, exclude_id=rid):
        raise HTTPException(400, "El vehículo no está disponible en esas fechas")
    upd = data.model_dump()
    veh = await db.vehicles.find_one({"id": data.vehicle_id})
    if not upd.get("total_price"):
        d = days_between(data.pickup_date, data.return_date)
        upd["total_price"] = round(d * float(veh["daily_price"]), 2)
    await db.reservations.update_one({"id": rid}, {"$set": upd})
    return await db.reservations.find_one({"id": rid}, {"_id": 0})


@api.delete("/reservations/{rid}")
async def delete_reservation(rid: str, user: dict = Depends(require_admin)):
    res = await db.reservations.find_one({"id": rid})
    if not res:
        raise HTTPException(404, "Reserva no encontrada")
    await db.payments.delete_many({"reservation_id": rid})
    await db.reservations.delete_one({"id": rid})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------
@api.get("/payments")
async def list_payments(user: dict = Depends(get_current_user), reservation_id: Optional[str] = None):
    q = {"reservation_id": reservation_id} if reservation_id else {}
    items = await db.payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api.post("/payments")
async def create_payment(data: PaymentIn, user: dict = Depends(get_current_user)):
    res = await db.reservations.find_one({"id": data.reservation_id}, {"_id": 0})
    if not res:
        raise HTTPException(404, "Reserva no encontrada")

    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    doc["created_by"] = user["id"]
    await db.payments.insert_one(doc)

    paid = float(res.get("paid_amount", 0)) + float(data.amount)
    total = float(res.get("total_price", 0))
    if paid >= total:
        new_status = "pagado"
    elif paid > 0:
        new_status = "parcial"
    else:
        new_status = "pendiente"
    await db.reservations.update_one(
        {"id": data.reservation_id},
        {"$set": {"paid_amount": round(paid, 2), "payment_status": new_status}},
    )
    doc.pop("_id", None)
    return doc


@api.delete("/payments/{pid}")
async def delete_payment(pid: str, user: dict = Depends(require_admin)):
    pay = await db.payments.find_one({"id": pid}, {"_id": 0})
    if not pay:
        raise HTTPException(404, "Pago no encontrado")
    await db.payments.delete_one({"id": pid})
    res = await db.reservations.find_one({"id": pay["reservation_id"]}, {"_id": 0})
    if res:
        paid = float(res.get("paid_amount", 0)) - float(pay["amount"])
        paid = max(0.0, paid)
        total = float(res.get("total_price", 0))
        new_status = "pagado" if paid >= total and total > 0 else ("parcial" if paid > 0 else "pendiente")
        await db.reservations.update_one(
            {"id": pay["reservation_id"]},
            {"$set": {"paid_amount": round(paid, 2), "payment_status": new_status}},
        )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    active = await db.reservations.count_documents({"status": "en_curso"})
    confirmed = await db.reservations.count_documents({"status": "confirmada"})
    available = await db.vehicles.count_documents({"status": "disponible"})
    total_vehicles = await db.vehicles.count_documents({})

    # revenue: sum of all payments
    total_revenue_agg = await db.payments.aggregate(
        [{"$group": {"_id": None, "sum": {"$sum": "$amount"}}}]
    ).to_list(1)
    total_revenue = total_revenue_agg[0]["sum"] if total_revenue_agg else 0

    # pending payments: sum of (total_price - paid_amount) for non-cancelled
    pending = 0.0
    async for r in db.reservations.find({"status": {"$ne": "cancelada"}}, {"_id": 0}):
        pending += max(0.0, float(r.get("total_price", 0)) - float(r.get("paid_amount", 0)))

    recent = await db.reservations.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    cust_ids = {x["customer_id"] for x in recent}
    veh_ids = {x["vehicle_id"] for x in recent}
    custs = {c["id"]: c async for c in db.customers.find({"id": {"$in": list(cust_ids)}}, {"_id": 0})}
    vehs = {v["id"]: v async for v in db.vehicles.find({"id": {"$in": list(veh_ids)}}, {"_id": 0})}
    for it in recent:
        it["customer_name"] = custs.get(it["customer_id"], {}).get("full_name", "—")
        it["vehicle_name"] = vehs.get(it["vehicle_id"], {}).get("name", "—")

    # 7-day revenue trend
    trend = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).date()
        d_str = d.isoformat()
        agg = await db.payments.aggregate([
            {"$match": {"created_at": {"$regex": f"^{d_str}"}}},
            {"$group": {"_id": None, "sum": {"$sum": "$amount"}}},
        ]).to_list(1)
        trend.append({"date": d_str, "revenue": agg[0]["sum"] if agg else 0})

    return {
        "active_rentals": active + confirmed,
        "available_vehicles": available,
        "total_vehicles": total_vehicles,
        "total_revenue": round(total_revenue, 2),
        "pending_payments": round(pending, 2),
        "recent_reservations": recent,
        "revenue_trend": trend,
    }


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
@api.get("/reports/summary")
async def reports_summary(user: dict = Depends(get_current_user), period: str = "month"):
    """period: week or month"""
    days = 7 if period == "week" else 30
    start = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    total_rentals = await db.reservations.count_documents({"created_at": {"$gte": start}})
    revenue_agg = await db.payments.aggregate([
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {"_id": None, "sum": {"$sum": "$amount"}}},
    ]).to_list(1)
    revenue = revenue_agg[0]["sum"] if revenue_agg else 0

    pending = 0.0
    async for r in db.reservations.find({"status": {"$ne": "cancelada"}}, {"_id": 0}):
        pending += max(0.0, float(r.get("total_price", 0)) - float(r.get("paid_amount", 0)))

    # most rented vehicles
    pipeline = [
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {"_id": "$vehicle_id", "count": {"$sum": 1}, "revenue": {"$sum": "$total_price"}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    rows = await db.reservations.aggregate(pipeline).to_list(10)
    veh_ids = [r["_id"] for r in rows]
    vehs = {v["id"]: v async for v in db.vehicles.find({"id": {"$in": veh_ids}}, {"_id": 0})}
    top_vehicles = [
        {"vehicle_id": r["_id"], "name": vehs.get(r["_id"], {}).get("name", "—"),
         "license_plate": vehs.get(r["_id"], {}).get("license_plate", ""),
         "rentals": r["count"], "revenue": round(r["revenue"], 2)}
        for r in rows
    ]

    return {
        "period": period,
        "total_rentals": total_rentals,
        "revenue": round(revenue, 2),
        "pending_payments": round(pending, 2),
        "top_vehicles": top_vehicles,
    }


@api.get("/reports/export")
async def export_csv(user: dict = Depends(get_current_user), period: str = "month"):
    days = 7 if period == "week" else 30
    start = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    items = await db.reservations.find({"created_at": {"$gte": start}}, {"_id": 0}).to_list(5000)
    cust_ids = {x["customer_id"] for x in items}
    veh_ids = {x["vehicle_id"] for x in items}
    custs = {c["id"]: c async for c in db.customers.find({"id": {"$in": list(cust_ids)}}, {"_id": 0})}
    vehs = {v["id"]: v async for v in db.vehicles.find({"id": {"$in": list(veh_ids)}}, {"_id": 0})}

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["N° Reserva", "Cliente", "Vehículo", "Placa", "Fecha Recogida", "Fecha Devolución",
                "Total", "Pagado", "Estado Pago", "Estado Reserva", "Creada"])
    for it in items:
        c = custs.get(it["customer_id"], {})
        v = vehs.get(it["vehicle_id"], {})
        w.writerow([
            it.get("reservation_number", ""),
            c.get("full_name", ""),
            v.get("name", ""),
            v.get("license_plate", ""),
            it.get("pickup_date", ""),
            it.get("return_date", ""),
            it.get("total_price", 0),
            it.get("paid_amount", 0),
            it.get("payment_status", ""),
            it.get("status", ""),
            it.get("created_at", ""),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=reporte_{period}.csv"},
    )


# ---------------------------------------------------------------------------
# Calendar view: list reservations between dates
# ---------------------------------------------------------------------------
@api.get("/reservations/calendar")
async def reservations_calendar(
    user: dict = Depends(get_current_user),
    start: str = Query(...),
    end: str = Query(...),
):
    items = await db.reservations.find(
        {
            "$or": [
                {"pickup_date": {"$gte": start, "$lte": end}},
                {"return_date": {"$gte": start, "$lte": end}},
                {"$and": [{"pickup_date": {"$lte": start}}, {"return_date": {"$gte": end}}]},
            ]
        },
        {"_id": 0},
    ).to_list(2000)
    cust_ids = {x["customer_id"] for x in items}
    veh_ids = {x["vehicle_id"] for x in items}
    custs = {c["id"]: c async for c in db.customers.find({"id": {"$in": list(cust_ids)}}, {"_id": 0})}
    vehs = {v["id"]: v async for v in db.vehicles.find({"id": {"$in": list(veh_ids)}}, {"_id": 0})}
    for it in items:
        it["customer_name"] = custs.get(it["customer_id"], {}).get("full_name", "—")
        it["vehicle_name"] = vehs.get(it["vehicle_id"], {}).get("name", "—")
    return items


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "RentaFlow", "ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.vehicles.create_index("id", unique=True)
    await db.vehicles.create_index("license_plate", unique=True)
    await db.customers.create_index("id", unique=True)
    await db.reservations.create_index("id", unique=True)
    await db.reservations.create_index("reservation_number", unique=True)
    await db.payments.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@rentcar.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Administrador",
            "role": "admin",
            "password_hash": hash_password(admin_password),
            "created_at": now_iso(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )

    # Seed staff demo user if not exists
    staff_email = "staff@rentcar.com"
    if not await db.users.find_one({"email": staff_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": staff_email,
            "name": "Personal",
            "role": "staff",
            "password_hash": hash_password("staff123"),
            "created_at": now_iso(),
        })


@app.on_event("shutdown")
async def shutdown():
    client.close()
