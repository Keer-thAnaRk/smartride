# SmartRide — Phase 1 Architecture & Stabilization Reference

This document serves as the authoritative architectural record for the SmartRide platform following the completion and verification of the Phase 1 Stabilization Plan.

---

## 1. Application Stack

- **Framework**: Next.js 14 (App Router, React 18, TypeScript)
- **Frontend Architecture**: Client Components (`'use client'`) and React Context (`AuthContext`) paired with responsive Tailwind CSS components, Lucide React icons, and Recharts visualization.
- **Backend Architecture**: RESTful API Route Handlers under `src/app/api` utilizing Node.js runtime and Next.js Edge Middleware for route protection.
- **Authentication**: Stateless HMAC-SHA256 JSON Web Tokens (JWT) signed server-side and exchanged via `httpOnly` secure cookies. Passwords hashed using `bcryptjs` with optional Firebase Auth identity synchronization.
- **Databases & Storage**:
  - **Cloud Firestore**: Primary persistent data store for users, driver profiles, vehicles, corridor routes, subscriptions, and bookings.
  - **Prisma ORM (SQLite)**: Relational schema for corridor safety telemetry, security audit logs, gamification records, and safe-arrival sessions.
  - **MemoryStore**: High-resilience in-memory fallback store (`src/lib/firestore-db.ts`) ensuring zero-failure operation when external cloud network access is disconnected.
- **Styling**: Tailwind CSS with PostCSS and custom corporate shuttle UI theme.

---

## 2. Authentication & Session Architecture

### JWT Session Specification
- **Token Format**: Standard three-part HMAC-SHA256 signed JWT (`header.payload.signature`).
- **Cookie Name**: `smartride_token`
- **Cookie Flags**: `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 7 days`.
- **Payload Schema**:
  ```json
  {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "ADMIN | DRIVER | COMMUTER",
    "phone": "string | null",
    "avatar": "string | null",
    "iat": 1790745000,
    "exp": 1791349800
  }
  ```

### Authentication Flow
1. **Login (`POST /api/auth/login`)**:
   - Accepts `{ email, password }`.
   - Compares password against stored bcrypt hash (or verified credentials for documented demo accounts).
   - Generates signed JWT session and sets `smartride_token` cookie.
   - Logs security event (`AUTH_LOGIN_SUCCESS` or `AUTH_LOGIN_FAILURE`) in the security audit trail.
   - Never exposes passwords, hashes, or internal database identifiers.
2. **Registration (`POST /api/auth/register`)**:
   - Accepts user details and assigns role.
   - **Enforced Security Rule**: Public registration strictly permits `COMMUTER` and `DRIVER` accounts. Any request attempting to register with `role: 'ADMIN'` is rejected with HTTP `403 Forbidden`.
   - Driver registrations initialize with `isVerified: false`.
3. **Session Verification (`GET /api/auth/me`)**:
   - Cryptographically verifies the cookie signature.
   - Returns active user session and role-specific profile without sensitive fields.
4. **Logout (`POST /api/auth/me`)**:
   - Deletes the `smartride_token` cookie with `maxAge: 0` and immediate expiration (`expires: new Date(0)`).
5. **Edge Middleware (`src/middleware.ts`)**:
   - Intercepts requests to `/admin/*`, `/driver/*`, `/commuter/*`, and `/profile/*`.
   - Cryptographically validates token signatures at the Edge.
   - Enforces role boundaries: users without `ADMIN` role are redirected away from `/admin/*`.

---

## 3. Role-Based Access Control (RBAC)

The platform enforces three strictly separated roles:

| Role | Accessible Frontend Routes | Authorized Capabilities |
| :--- | :--- | :--- |
| **`ADMIN`** | `/admin/*`, `/commuter/plans`, `/profile` | Operations command center, driver verification/revocation, route creation, fleet load balancing, security anomaly resolution, AI demand prediction. |
| **`DRIVER`** | `/driver/*` (conditional), `/profile` | Vehicle & document onboarding. When verified: passenger roster check-in, shift start/complete, earnings tracking, leave applications. |
| **`COMMUTER`** | `/commuter/*`, `/plans`, `/profile` | Corridor route discovery, pass subscriptions, seat bookings, live ETA tracking, QR/OTP boarding code, attendance marking, family safe-arrival alerts. |

---

## 4. Driver Verification Lifecycle

Driver operational authorization is enforced on both frontend and backend APIs:

```
[ New Driver Registration ]
           ↓
   driverProfile.isVerified = false  (PENDING)
   • Operational navigation locked
   • Operational APIs return HTTP 403
   • Accessible: /driver/onboarding, /api/driver/onboarding
           ↓
[ Admin Document Review in /admin/drivers ]
           ↓
  ┌─────────────────────────┴─────────────────────────┐
  ↓                                                   ↓
[ APPROVE ]                                       [ REVOKE / REJECT ]
driverProfile.isVerified = true                   driverProfile.isVerified = false
• Operational navigation unlocked                 • Operational access blocked immediately
• Roster, trips, check-in active (200)            • Operational APIs return HTTP 403
```

- **PENDING**: The driver dashboard displays a persistent "Verification Pending" advisory banner. Operational links (Roster, Earnings, Vehicle Documents) are hidden. Requests to `/api/driver/roster`, `/api/driver/earnings`, `/api/driver/trip`, `/api/driver/check-in`, and `/api/driver/leave` return HTTP `403 Forbidden`.
- **APPROVED**: Admin approves the driver via `PATCH /api/admin/drivers`. Operational navigation tabs become visible and operational APIs respond with HTTP `200 OK`.
- **REVOKED**: If an admin revokes approval, all operational capabilities are immediately locked on the next request.

---

## 5. Major Platform Modules

### 1. Admin Command & Operations
- **Driver Verification (`/admin/drivers`)**: Audit driver licenses, RC books, insurance policies; approve or revoke verification status.
- **Corridor Routes (`/admin/routes`)**: Create corridor express routes (`POST /api/routes`) with origin, destination, intermediate pickup/drop waypoints, and assigned drivers/vehicles.
- **Fleet Seat Optimization (`/admin/allocations`)**: Load-balancing corridors, passenger capacity utilization, and shuttle dispatch planning.
- **Leave Management (`/admin/leaves`)**: Review driver leave applications and assign verified replacement drivers with compliant vehicles.
- **Security & Anomaly Command Center (`/admin/security`)**: Real-time anomaly feed (speed violations, corridor deviations, stale GPS telemetry) with incident investigation and resolution workflows.
- **AI Demand Prediction**: Machine-learning regression forecasting corridor passenger demand and required fleet sizing.

### 2. Driver Operations
- **Verification & Onboarding (`/driver/onboarding`)**: Document submission portal for commercial driver license, RC book, and vehicle insurance.
- **Daily Roster (`/api/driver/roster`)**: Real-time passenger manifest for assigned corridor trips with OTP validation and boarding status check-off.
- **Corridor Trips (`/api/driver/trip`)**: Shift initiation, live GPS telemetry transmission, and trip completion dispatch.
- **Driver Check-In (`/api/driver/check-in`)**: 15-minute pre-trip readiness check-in banner.
- **Earnings & Payouts (`/driver/earnings`)**: Transparent monthly earnings projections based on active subscribers and shift bonuses.
- **Leave Requests (`/api/driver/leave`)**: Formal driver leave submission with automated replacement driver validation.

### 3. Commuter Experience
- **Route Discovery (`/api/routes`)**: Search and select corporate corridor shuttles with live stop timings and distances.
- **Subscription Management (`/api/subscriptions`)**: Monthly, quarterly, and annual passes with guaranteed reserved AC seating.
- **Booking Flow (`/api/bookings`)**: Seat allocation tied directly to commuter subscription and route corridor.
- **Attendance & Skip-Ride (`/api/commuter/attendance`)**: Mark daily attendance or skip rides to bank rollover credits.
- **Family Safe Arrival (`/track/[shareToken]`)**: Zero-leakage public tracking links with automatic corridor arrival notifications.
- **Gamification & Sustainability**: Punctuality streaks, XP levels, and verified carbon emission savings calculations.

---

## 6. Authoritative Data Flow & Ownership Model

### Identity Resolution Rule
```
Incoming HTTP Request
       ↓
Extract smartride_token cookie
       ↓
Verify HMAC-SHA256 Signature
       ↓
Extract session.id & session.role
       ↓
[ Authoritative Server Identity: session.id ]
```
- **Rule**: Client-supplied user identifiers (such as `commuterId`, `userId`, `driverId`) in request bodies or query parameters are **never trusted** for authorization. The server strictly uses `session.id` derived from the verified JWT.

### Commuter Resource Flow
```
Commuter Selects Route (routeId)
       ↓
Creates Subscription (POST /api/subscriptions)
  ↳ Server binds: commuterId = session.id
       ↓
Creates Booking (POST /api/bookings)
  ↳ Server binds: commuterId = session.id, routeId = route.id, subscriptionId = sub.id
       ↓
Access Resource (GET /api/subscriptions/[id], GET /api/bookings/[id])
  ↳ Server verifies: resource.commuterId === session.id (Mismatch → 403 Forbidden)
```

### Driver Dispatch Flow
```
Admin Approves Driver (PATCH /api/admin/drivers)
       ↓
Admin Assigns Driver to Route (POST /api/routes)
       ↓
Driver Authenticates (session.role === 'DRIVER')
       ↓
Server verifies driverProfile.isVerified === true
       ↓
Driver accesses Roster, Starts Trip, & Marks Attendance (200 OK)
```

---

## 7. Important API Authorization Matrix

| Endpoint | Method | Permitted Roles | Description / Security Boundary |
| :--- | :---: | :--- | :--- |
| `/api/auth/login` | POST | Public | Authenticates credentials and issues signed JWT session cookie. |
| `/api/auth/register` | POST | Public (Restricted) | Allows COMMUTER and DRIVER registrations; rejects ADMIN with 403. |
| `/api/auth/me` | GET, POST | Authenticated | Retrieves current session profile (GET) or logs out (POST). |
| `/api/plans` | GET | Public | Public pricing catalog for commute subscription passes. |
| `/api/routes` | GET | Public | Public catalog of active corridor routes with sanitized driver info. |
| `/api/routes` | POST | `ADMIN` | Creates new corridor route with waypoints and driver assignment. |
| `/api/subscriptions` | GET, POST | `COMMUTER`, `ADMIN` | List own subscriptions or create new subscription bound to `session.id`. |
| `/api/subscriptions/[id]` | GET, PATCH, DEL | Owner, `ADMIN` | Strict ownership verification; non-owners blocked with 403. |
| `/api/bookings` | GET | `COMMUTER`, `ADMIN` | Returns own bookings for commuters; all bookings for admin. |
| `/api/bookings/[id]` | GET, PATCH, DEL | Owner, `ADMIN` | Strict ownership verification; non-owners blocked with 403. |
| `/api/commuter/*` | ALL | `COMMUTER`, `ADMIN` | Profile, attendance, payments, notifications, gamification, sustainability. |
| `/api/track/generate` | POST | `COMMUTER`, `ADMIN` | Generates secure family tracking bearer token bound to `session.id`. |
| `/api/track/[shareToken]` | GET | Public | Read-only public tracking status projection for family tracking links. |
| `/api/driver/onboarding` | GET, POST | `DRIVER`, `ADMIN` | Upload license and vehicle documents (pending or approved drivers). |
| `/api/driver/roster` | GET, PATCH | Approved `DRIVER` | Access shift roster and mark passenger attendance (requires `isVerified`). |
| `/api/driver/trip` | POST | Approved `DRIVER` | Start shift or complete trip (requires `isVerified`). |
| `/api/driver/check-in` | POST | Approved `DRIVER` | 15-minute operational check-in (requires `isVerified`). |
| `/api/driver/earnings` | GET | Approved `DRIVER` | Payout history and monthly earnings projections (requires `isVerified`). |
| `/api/driver/leave` | GET, POST | Approved `DRIVER` | Leave request submission and status lookup (requires `isVerified`). |
| `/api/admin/*` | ALL | `ADMIN` | Platform metrics, allocations, driver approval, security events. |
| `/api/tracking/simulate` | POST | `ADMIN` | Admin family tracking delay/arrival test simulation. |
| `/api/security/anomalies/simulate` | POST | `ADMIN`, `DRIVER` | Security telemetry and anomaly testing simulator. |

---

## 8. Existing Functionality Inventory

### A. Existing Stabilized Functionality
1. Role-based authentication and registration with generic error handling and password bcrypt security.
2. Edge middleware route protection for `/admin/*`, `/driver/*`, and `/commuter/*`.
3. Complete driver verification lifecycle (Pending → Approved → Revoked) enforced on UI and backend APIs.
4. Admin driver management portal with document inspection and one-click status transitions.
5. Corridor route discovery, selection, and administrative route creation.
6. Commuter pass subscription and booking management with server-side IDOR defense.
7. Commuter dashboard displaying active subscriptions, upcoming rides, attendance history, and QR codes.
8. Driver shift execution with manifest check-off and OTP verification.
9. Operations command center with incident response and safety scoring.
10. AI corridor passenger demand forecasting with Random Forest regression inference.
11. Public family tracking share links with zero passenger data leakage.

### B. Existing Demo & Seed Data
- **Demo Accounts** (`src/app/api/auth/login/route.ts`):
  - `admin@smartride.com` / `<LOCAL_DEVELOPMENT_PASSWORD>` (Elena Rostova - ADMIN)
  - `driver.rajesh@smartride.com` / `<LOCAL_DEVELOPMENT_PASSWORD>` (Rajesh Sharma - DRIVER, Approved)
  - `commuter.rahul@smartride.com` / `<LOCAL_DEVELOPMENT_PASSWORD>` (Rahul Verma - COMMUTER)
- **Corridor Routes**: `SR-101` (Whitefield Express), `SR-102` (Electronic City Direct), `SR-103` (Outer Ring Road Shuttle).
- **Subscription Plans**: `plan_monthly` (₹3,499), `plan_quarterly` (₹9,499), `plan_yearly` (₹34,999).

### C. Post-Freeze Technical Debt
The following items are intentionally recorded as technical debt for future iterations:
1. **Payment Webhook Cryptographic Verification**: `POST /api/webhooks/payment` processes simulated payment events without validating cryptographic HMAC provider signatures (`stripe-signature` / `x-razorpay-signature`).
2. **Profile Avatar Cloud Storage**: `POST /api/profile/photo` writes uploaded avatar files to local filesystem storage (`public/uploads/avatars/`) rather than cloud object storage (AWS S3 / Google Cloud Storage).
3. **Historical Telemetry Persistence & Replay**: Live vehicle tracking simulation updates in-memory states and Firestore trip documents, but lacks persistent historical GPX coordinate trail recording.
4. **Third-Party SMS/WhatsApp Gateway Integration**: SOS panic alerts and family arrival notifications are recorded in database records and reflected in real-time UI, but lack live third-party SMS/WhatsApp gateway dispatch (Twilio/Gupshup).

---

## 9. Protection Rules for Future Development

1. **Non-Regression Rule**:
   > *"Future feature development must not modify existing stabilized functionality unless the change is explicitly required and regression-tested."*
2. **Modular Extension Rule**:
   > *"Smart Commute Intelligence & Safety will be implemented as a controlled new module on top of the stabilized Phase 1 architecture."*
