import os
import uuid
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if "REACT_APP_BACKEND_URL" in os.environ else None
if not BASE:
    # Load from frontend/.env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": "admin@rentcar.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    assert r.cookies.get("access_token")
    data = r.json()
    assert data["role"] == "admin"
    return s


@pytest.fixture(scope="session")
def staff():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": "staff@rentcar.com", "password": "staff123"})
    assert r.status_code == 200, r.text
    return s


# ---- Auth ----
def test_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@rentcar.com", "password": "WRONG_" + uuid.uuid4().hex})
    assert r.status_code in (401, 429)


def test_me(admin):
    r = admin.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "admin@rentcar.com"


def test_me_unauth():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


# ---- Vehicles ----
@pytest.fixture(scope="session")
def vehicle(admin):
    plate = "TST-" + uuid.uuid4().hex[:6].upper()
    r = admin.post(f"{API}/vehicles", json={
        "name": "TEST_Toyota Corolla", "license_plate": plate,
        "category": "compacto", "daily_price": 50.0, "status": "disponible"
    })
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["license_plate"] == plate
    yield v
    admin.delete(f"{API}/vehicles/{v['id']}")


def test_vehicle_duplicate_plate(admin, vehicle):
    r = admin.post(f"{API}/vehicles", json={
        "name": "dup", "license_plate": vehicle["license_plate"],
        "category": "compacto", "daily_price": 10.0
    })
    assert r.status_code == 400


def test_vehicle_list_filter(admin, vehicle):
    r = admin.get(f"{API}/vehicles", params={"q": vehicle["license_plate"]})
    assert r.status_code == 200
    assert any(x["id"] == vehicle["id"] for x in r.json())


def test_vehicle_update(admin, vehicle):
    r = admin.put(f"{API}/vehicles/{vehicle['id']}", json={
        "name": "TEST_Updated", "license_plate": vehicle["license_plate"],
        "category": "suv", "daily_price": 75.0, "status": "disponible"
    })
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Updated"
    assert r.json()["daily_price"] == 75.0


def test_staff_cannot_delete_vehicle(staff, admin):
    r = admin.post(f"{API}/vehicles", json={
        "name": "TEST_tmp", "license_plate": "DEL-" + uuid.uuid4().hex[:6].upper(),
        "category": "economico", "daily_price": 20.0
    })
    vid = r.json()["id"]
    r2 = staff.delete(f"{API}/vehicles/{vid}")
    assert r2.status_code == 403
    admin.delete(f"{API}/vehicles/{vid}")


# ---- Customers ----
@pytest.fixture(scope="session")
def customer(admin):
    r = admin.post(f"{API}/customers", json={
        "full_name": "TEST_John Doe", "phone": "555-0100",
        "email": f"test_{uuid.uuid4().hex[:6]}@example.com",
        "identification": "ID-" + uuid.uuid4().hex[:6]
    })
    assert r.status_code == 200, r.text
    c = r.json()
    yield c
    admin.delete(f"{API}/customers/{c['id']}")


def test_customer_get_with_history(admin, customer):
    r = admin.get(f"{API}/customers/{customer['id']}")
    assert r.status_code == 200
    data = r.json()
    assert data["customer"]["id"] == customer["id"]
    assert "history" in data


# ---- Reservations ----
@pytest.fixture(scope="session")
def reservation(admin, customer, vehicle):
    r = admin.post(f"{API}/reservations", json={
        "customer_id": customer["id"], "vehicle_id": vehicle["id"],
        "pickup_date": "2030-01-10", "return_date": "2030-01-15",
        "status": "confirmada"
    })
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["reservation_number"].startswith("RES-")
    # total = 5 days * 75 (updated price from test_vehicle_update) OR 50
    assert res["total_price"] > 0
    assert res["paid_amount"] == 0
    yield res
    admin.delete(f"{API}/reservations/{res['id']}")


def test_reservation_double_booking(admin, customer, vehicle, reservation):
    r = admin.post(f"{API}/reservations", json={
        "customer_id": customer["id"], "vehicle_id": vehicle["id"],
        "pickup_date": "2030-01-12", "return_date": "2030-01-14",
    })
    assert r.status_code == 400


def test_reservation_invalid_customer(admin, vehicle):
    r = admin.post(f"{API}/reservations", json={
        "customer_id": "nonexistent-id", "vehicle_id": vehicle["id"],
        "pickup_date": "2031-01-10", "return_date": "2031-01-12"
    })
    assert r.status_code == 404


def test_reservation_list_enriched(admin, reservation):
    r = admin.get(f"{API}/reservations")
    assert r.status_code == 200
    match = [x for x in r.json() if x["id"] == reservation["id"]]
    assert match and "customer_name" in match[0] and "vehicle_name" in match[0]


def test_reservation_calendar(admin, reservation):
    r = admin.get(f"{API}/reservations/calendar", params={"start": "2030-01-01", "end": "2030-01-31"})
    assert r.status_code == 200
    assert any(x["id"] == reservation["id"] for x in r.json())


# ---- Payments ----
def test_payment_and_status(admin, reservation):
    total = reservation["total_price"]
    # partial
    r = admin.post(f"{API}/payments", json={
        "reservation_id": reservation["id"], "amount": total / 2, "method": "efectivo"
    })
    assert r.status_code == 200
    pid = r.json()["id"]
    res = admin.get(f"{API}/reservations").json()
    match = next(x for x in res if x["id"] == reservation["id"])
    assert match["payment_status"] == "parcial"

    # full
    r2 = admin.post(f"{API}/payments", json={
        "reservation_id": reservation["id"], "amount": total / 2, "method": "tarjeta"
    })
    assert r2.status_code == 200
    res = admin.get(f"{API}/reservations").json()
    match = next(x for x in res if x["id"] == reservation["id"])
    assert match["payment_status"] == "pagado"

    # staff cannot delete payment
    staff_s = requests.Session()
    staff_s.post(f"{API}/auth/login", json={"email": "staff@rentcar.com", "password": "staff123"})
    assert staff_s.delete(f"{API}/payments/{pid}").status_code == 403

    # admin delete reverts
    assert admin.delete(f"{API}/payments/{pid}").status_code == 200
    res = admin.get(f"{API}/reservations").json()
    match = next(x for x in res if x["id"] == reservation["id"])
    assert match["payment_status"] == "parcial"


# ---- Dashboard & Reports ----
def test_dashboard_stats(admin):
    r = admin.get(f"{API}/dashboard/stats")
    assert r.status_code == 200
    data = r.json()
    for k in ["active_rentals", "available_vehicles", "total_revenue", "pending_payments",
              "recent_reservations", "revenue_trend"]:
        assert k in data
    assert len(data["revenue_trend"]) == 7


def test_reports_summary(admin):
    r = admin.get(f"{API}/reports/summary", params={"period": "month"})
    assert r.status_code == 200
    data = r.json()
    assert "total_rentals" in data and "top_vehicles" in data


def test_reports_export_csv(admin):
    r = admin.get(f"{API}/reports/export", params={"period": "month"})
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert "attachment" in r.headers.get("content-disposition", "")
    assert "N° Reserva" in r.text or "Reserva" in r.text


# ---- Logout ----
def test_logout():
    s = requests.Session()
    s.post(f"{API}/auth/login", json={"email": "admin@rentcar.com", "password": "admin123"})
    r = s.post(f"{API}/auth/logout")
    assert r.status_code == 200
