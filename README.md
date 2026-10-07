# Smart Ride – Monthly Pickup & Drop Subscription Platform 🚗⚡

Smart Ride is a production-ready, full-stack B2C & B2B commute subscription platform connecting daily corporate commuters with verified route captains on fixed, scheduled morning pickup and evening return routes.

---

## 🌟 Key Modules & Features

### 1. Authentication & Role-Based Access Control (RBAC)
- **3 Secure Roles**: `COMMUTER`, `DRIVER`, `ADMIN`.
- **JWT & Password Security**: Encrypted with `bcryptjs` and signed with JSON Web Tokens.
- **Route Guard Middleware**: Protects `/commuter/*`, `/driver/*`, and `/admin/*`.
- **1-Click Demo Role Switcher**: Quick-switch in the navigation bar to immediately test Commuter, Driver, and Admin views without manual typing.

### 2. Commuter Experience
- **Interactive Subscription Checkout**: Corridor route selector (`SR-101`, `SR-102`, `SR-103`), pickup stop & drop hub customizer, and duration selector (Monthly, Quarterly 10% off, Yearly 16% off).
- **Stripe & Razorpay Mock Payment Gateway**: Simulated card, UPI QR, and netbanking flows with instant webhook fulfillment and digital invoice generation.
- **Live Commuter Dashboard**: Assigned driver card with rating and phone, reserved seat #, today's schedule, one-click "Skip Today's Ride" toggle, and route stop sequence.
- **Tax Invoices**: Itemized tax invoice previews with instant PDF download and print view.
- **Profile Manager**: Configure default home and office coordinates, shift timings, and emergency contacts.

### 3. Driver Route Captain Portal
- **Daily Commuter Manifest & Roster**: Shift toggle for Morning Pickup vs Evening Return, passenger manifests with seat numbers and pickup points.
- **Live Trip Controller**: One-click "Start Dispatch" -> Mark passenger "Boarded" / "No-Show" -> "Complete Trip".
- **Earnings & Payouts**: Monthly gross earnings, daily payout projections, bi-weekly direct deposit history, and driver rating breakdown.
- **Driver & Vehicle Onboarding**: License submission, vehicle category selection (Sedan, SUV, Mini-Bus), seat capacity, and RC document verification status.

### 4. Admin Command Center
- **Executive KPIs**: Real-time Monthly Recurring Revenue (MRR), Annual Run Rate (ARR), total active subscribers, low churn rate (2.4%), and fleet seat utilization %.
- **Driver Verification Queue**: Inspect submitted driver licenses, approve or reject KYC with 1 click.
- **Route Network Builder**: Create and manage tech corridor routes with custom stops, timings, distance, and driver/vehicle assignments.
- **Seat Allocation Matrix**: View real-time shuttle seat maps and auto/manual reassign commuters to routes with capacity checks.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Axios
- **Backend**: Next.js Server Route Handlers (`/api/...`)
- **Database**: SQLite (Zero-config out of the box) / PostgreSQL with Prisma ORM
- **Authentication**: JWT Cookie & Header sessions with `bcryptjs`
- **Payment & Webhooks**: Mock Stripe & Razorpay Webhook Engine

---

## 🚀 Quick Setup & Installation

### 1. Prerequisites
- Node.js (v18.x or higher, v24 recommended)
- npm or pnpm or yarn

### 2. Clone & Install Dependencies
```bash
git clone <repo-url>
cd fearless-galileo
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (or use the pre-configured `.env`):
```env
# Database Connection (SQLite default, PostgreSQL ready)
DATABASE_URL="file:./dev.db"

# JWT Secret (Must be minimum 32 random characters for HMAC-SHA256)
JWT_SECRET="GENERATE_A_LONG_RANDOM_SECRET_LOCALLY"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Mock Payment Keys (Stripe / Razorpay)
STRIPE_SECRET_KEY="sk_test_smartride_mock_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_smartride_mock_webhook_secret"
RAZORPAY_KEY_ID="rzp_test_smartride_key_id"
RAZORPAY_KEY_SECRET="rzp_test_smartride_secret"
```

### 4. Initialize Database & Seed Demo Data
```bash
# Push schema to SQLite database
npx prisma db push

# Seed sample drivers, commuters, routes, vehicles, subscriptions, and trips
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Pre-Seeded Development Test Accounts

In local development environments, configure credentials via environment variables (`DEMO_ADMIN_PASSWORD`, `DEMO_DRIVER_PASSWORD`, `DEMO_COMMUTER_PASSWORD`) or use local seed defaults:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@smartride.com` | `<LOCAL_DEVELOPMENT_PASSWORD>` | Full access to KPI Command Center, KYC approvals, allocations |
| **Driver** | `driver.rajesh@smartride.com` | `<LOCAL_DEVELOPMENT_PASSWORD>` | Route SR-101 Captain, Toyota Innova Crysta, 4.96 ★ Rating |
| **Driver** | `driver.vikram@smartride.com` | `<LOCAL_DEVELOPMENT_PASSWORD>` | Route SR-102 Captain, Urbania Shuttle (12 seats) |
| **Commuter** | `commuter.rahul@smartride.com` | `<LOCAL_DEVELOPMENT_PASSWORD>` | Subscribed to SR-101 Morning & Evening, Seat #1 |
| **Commuter** | `commuter.priya@smartride.com` | `<LOCAL_DEVELOPMENT_PASSWORD>` | Subscribed to SR-101 (Quarterly Plan), Seat #2 |

*Note: Demo authentication shortcuts and default demo credentials are strictly disabled in production.*

---

## 📡 Key API Endpoints Reference

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register Commuter or Driver | Public |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | Public |
| `GET` | `/api/auth/me` | Current session & user profile | Logged In |
| `GET` | `/api/routes` | List corridor routes & stops | Public / Logged In |
| `POST` | `/api/routes` | Create new corridor route | `ADMIN` |
| `GET` | `/api/subscriptions` | User subscriptions | `COMMUTER` / `ADMIN` |
| `POST` | `/api/subscriptions` | Create subscription + mock payment | `COMMUTER` |
| `GET` | `/api/driver/roster` | Driver daily passenger manifest | `DRIVER` / `ADMIN` |
| `PATCH` | `/api/driver/roster` | Update commuter attendance (Boarded/No-Show) | `DRIVER` / `ADMIN` |
| `POST` | `/api/driver/trip` | Start or Complete shift dispatch | `DRIVER` / `ADMIN` |
| `GET` | `/api/driver/earnings`| Driver earnings & direct deposits | `DRIVER` |
| `GET` | `/api/admin/metrics` | Platform MRR, ARR, churn & utilization | `ADMIN` |
| `GET` | `/api/admin/drivers` | Driver KYC verification queue | `ADMIN` |
| `PATCH` | `/api/admin/drivers` | Approve/reject driver & vehicle | `ADMIN` |
| `GET` | `/api/admin/allocations`| Commuter & fleet seat matrix | `ADMIN` |
| `POST` | `/api/admin/allocations`| Reassign commuter to route/seat | `ADMIN` |
| `POST` | `/api/webhooks/payment`| Stripe / Razorpay mock webhook receiver | Public |

---

## 🏗️ Production Build Verification

To verify production compilation:
```bash
npm run build
```
The application builds cleanly with 0 type errors.
