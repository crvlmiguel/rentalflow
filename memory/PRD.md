# RentaFlow — PRD

## Original Problem Statement
SaaS web application for managing a car rental (rent-a-car) business with reservations, vehicles, customers, payments, reporting, dashboard, role-based auth (Admin/Staff), and a clean responsive interface.

## Architecture
- **Backend**: FastAPI (Python) at `0.0.0.0:8001`, all routes under `/api`
- **Frontend**: React 19 + React Router 7 + TailwindCSS + shadcn/ui + Recharts + Phosphor Icons
- **Database**: MongoDB (motor async driver)
- **Auth**: JWT in httpOnly cookies (access + refresh) with bcrypt-hashed passwords; brute-force lockout
- **Language**: Spanish UI

## User Personas
- **Owner / Admin**: full CRUD across vehicles, customers, reservations, payments; can delete records.
- **Staff (counter agent)**: create/edit reservations, customers, vehicles, payments — cannot delete.

## Core Requirements (Static)
1. Reservation management with auto-numbering (RES-YYYY-NNNNN), double-booking prevention, calendar view
2. Vehicle inventory with status (disponible / alquilado / mantenimiento)
3. Customer profiles with rental history
4. Payment tracking with auto-calculated balance and status (pendiente / parcial / pagado)
5. Dashboard with operational KPIs and 7-day revenue chart
6. Reports (week/month) with top vehicles + CSV export
7. Role-based access (admin / staff)

## What's Implemented (2026-04-27)
- ✅ JWT auth with bcrypt, httpOnly cookies, login/logout/me
- ✅ Admin + staff seed accounts (`admin@rentcar.com / admin123`, `staff@rentcar.com / staff123`)
- ✅ Vehicles CRUD with category, daily price, status, search
- ✅ Customers CRUD with search and history modal
- ✅ Reservations CRUD with overlap detection, auto-pricing, status enums
- ✅ Payments CRUD with running balance + auto status update
- ✅ Dashboard with 4 metric cards, recent reservations, revenue trend chart
- ✅ Calendar view (month grid, navigation, day-detail modal)
- ✅ Reports (week/month) with bar chart of top vehicles + CSV export
- ✅ Sidebar layout with mobile drawer, role-aware action buttons
- ✅ Spanish UI throughout, Cabinet Grotesk + Manrope typography
- ✅ Brute-force lockout (5 fails / 15 min)
- ✅ MongoDB indexes (unique on email, license_plate, ids, reservation_number)

## Backlog
**P1**
- Edit existing payment (currently delete-only after creation)
- Auto-transition reservation status (`confirmada` → `en_curso` → `completada`) by date cron
- Notifications: upcoming returns / overdue alerts
- PDF export (currently only CSV)

**P2**
- Multi-tenant (multiple rental businesses on same instance)
- Invoicing module
- GPS tracking integration
- Customer self-service portal
- Maintenance log per vehicle
- Refactor: split `server.py` into routers, atomic counter for reservation_number

## Test Credentials
See `/app/memory/test_credentials.md`
