# 🌱 SmartRide Sustainability & Carbon Impact Engine

## Executive Overview
The **SmartRide Sustainability & Carbon Impact Engine** is a deterministic environmental modeling system integrated into the SmartRide (CommuteSync) enterprise shuttle platform. It calculates verifiable, explainable carbon abatement and private car substitution metrics for individual commuters and whole transit corridors.

---

## 1. Zero-Greenwashing Commitment
In compliance with academic, corporate ESG, and municipal transport reporting standards:
> **Strict Anti-Greenwashing Guarantee**: All carbon metrics in SmartRide are explicitly labeled as:
> *"Modeled estimates based on configurable commute assumptions (Model v1.0). Not direct tailpipe sensor measurements."*

Every metric is stamped with an active model version tag (e.g. `v1.0`, `v1.1`), ensuring historical calculations remain reproducible and auditable.

---

## 2. Mathematical Methodology & Formulas

### A. Baseline Private Car Counterfactual
$$\text{Emissions}_{\text{baseline}}(t) = D_r \times EF_{\text{private}}$$
- $D_r$: Corridor distance in kilometers (`Route.distanceKm`).
- $EF_{\text{private}}$: Configurable private vehicle factor in $\text{kg CO}_2\text{e}/\text{km}$ (Default: $0.180\text{ kg/km}$ based on ARAI/CPCB urban standards).

### B. SmartRide Shuttle Total & Passenger Allocated Emissions
$$\text{Emissions}_{\text{shuttle}}(t) = D_r \times EF_{\text{shuttle}}(V_{\text{type}})$$
$$\text{Emissions}_{\text{passenger}}(t) = \frac{\text{Emissions}_{\text{shuttle}}(t)}{\max(1, N_{\text{passengers}}(t))}$$
- $EF_{\text{shuttle}}(V_{\text{type}})$: Vehicle-specific emission factor:
  - SEDAN: $0.180\text{ kg CO}_2\text{e}/\text{km}$
  - SUV: $0.220\text{ kg CO}_2\text{e}/\text{km}$
  - VAN (Innova / Urbania): $0.260\text{ kg CO}_2\text{e}/\text{km}$
  - MINI_BUS: $0.320\text{ kg CO}_2\text{e}/\text{km}$
- $N_{\text{passengers}}$: Verified boarded or subscribed riders on the shuttle run.

### C. Avoided $\text{CO}_2$ per Commuter Trip
$$\Delta\text{CO}_2(t) = \max\left(0, \text{Emissions}_{\text{baseline}}(t) - \text{Emissions}_{\text{passenger}}(t)\right)$$
- Guarantees strict non-negativity (e.g., solo travel in an oversized vehicle will clamp to $0\text{ kg}$ savings rather than claiming false reductions).

### D. Private Cars Displaced
- **Commuter View**: Net private car trips eliminated $= \text{round}(N_{\text{trips}} \times 0.85)$.
- **Fleet View**: $\sum \max(0, N_{\text{passengers}} - 1)$ private vehicles removed from the corridor road network per shuttle run.

### E. Shared Commute Adoption Percentage
$$\text{Shared Commute \%} = \min\left(100, \text{round}\left(\frac{\text{Completed SmartRide Trips}}{\text{Working Days} \times 2} \times 100\right)\right)$$
- Normalizes monthly travel against standard office attendance (e.g., 22 working days $\times$ 2 legs = 44 trips).

---

## 3. Architecture & Component Structure

### A. Core Library (`src/lib/sustainability/`)
- `carbon-config.ts`: Centralized assumptions, vehicle lookup tables, and default configurations.
- `carbon-types.ts`: TypeScript interfaces for calculations, monthly trends, and route analytics.
- `carbon-calculator.ts`: Deterministic calculation engine and rule-based natural language insight generator.

### B. Database Schema (`prisma/schema.prisma`)
- `SustainabilityModelConfig`: Active model version (`v1.0`), emission constants, working day definitions, and updater metadata.
- `SustainabilityRecord`: Persistent ledger of calculated trip emissions with model versioning.

### C. API Endpoints
- `GET /api/commuter/sustainability`: Commuter personal metrics, 6-month historical trend, and methodology explanation.
- `GET /api/admin/sustainability`: Fleet-wide aggregates, corridor leaderboard, and intelligent insights.
- `GET /api/admin/sustainability/config`: Active assumptions viewer.
- `POST /api/admin/sustainability/config`: Admin assumptions tuning with automatic model version incrementing (`v1.0` $\rightarrow$ `v1.1`).

### D. UI Interfaces
- `src/components/commuter/sustainability-card.tsx`: High-density commuter card embedded in `/commuter/dashboard` with KPI tiles, Recharts monthly trend, tree equivalency badge, and transparent methodology modal.
- `src/components/admin/sustainability-impact-center.tsx`: Executive sustainability center embedded in `/admin/dashboard` with fleet KPIs, route leaderboard, rule insights, and assumption editor modal.

---

## 4. Verification & Test Suite
The engine is validated by an automated test suite (`scripts/test-sustainability.ts`):
- **35 / 35 unit & integration tests passing** covering mathematical accuracy, edge cases, vehicle types, database persistence, and insights generation.
- **Zero regression** across Driver Coverage (36/36), Seat Optimization (33/33), Safe Arrival (25/25), Anomaly Detection (36/36), Safety Score (23/23), and Smart ETA (all pass).
- **TypeScript strict checking**: 0 compiler errors (`npx tsc --noEmit`).
- **Production Next.js build**: 32/32 routes compiled successfully.
