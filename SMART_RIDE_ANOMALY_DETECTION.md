# SmartRide — Anomaly Detection Technical Specification
**Phase 3 — Step 2: Anomaly Detection**  
**Classification:** Internal Core Architecture Specification  
**Status:** Verified & Frozen (Checkpoint 12)

---

## 1. Executive Summary & Purpose
This document defines the deterministic operational anomaly detection engine designed for the SmartRide platform. The anomaly detection layer processes real-time and simulated vehicle telemetry, corridor waypoints, trip operational state, driver/vehicle compliance status, and security metrics to detect operational anomalies.

> [!IMPORTANT]
> **Deterministic vs. Predictive Boundary**:
> This engine operates strictly through transparent, deterministic mathematical rules and geometric calculations based on known telemetry and scheduled timelines. It does **not** perform heuristic machine-learning training or statistical inference. Predictive Delay Detection and ML demand models are isolated to subsequent roadmap steps.

---

## 2. Existing Infrastructure Reused
The anomaly detection layer is built directly on top of pre-existing, stabilized SmartRide components:
1. **`prisma.safetyEvent`**: Primary SQLite table storing security and operational incidents (`type`, `severity`, `status`, `title`, `description`, `metadata`, `detectedAt`, `resolvedAt`).
2. **`prisma.securityAuditLog` & `logSecurityAudit`**: Immutable operational security audit logging system.
3. **`ANOMALY_CONFIG` (`src/lib/security/anomaly-config.ts`)**: Central configuration repository for speed limits, deviation distances, and timeouts.
4. **`calculateDistanceToCorridorMeters` (`src/lib/safety/anomaly-detection.ts`)**: Perpendicular line-segment projection algorithm measuring Euclidean/spherical deviation from designated waypoints.
5. **`SR101_CORRIDOR_WAYPOINTS` (`src/lib/ai/smart-eta.ts`)**: Authoritative corridor coordinates for tech corridor shuttles.
6. **`calculateRouteRiskScore` (`src/lib/safety/route-risk-engine.ts`)**: Phase 3 Step 1 authoritative Route Risk Scoring engine.
7. **`AnomalyMonitoringCenter` (`src/components/admin/anomaly-monitoring-center.tsx`)**: Pre-existing comprehensive SOC monitoring interface.

---

## 3. Supported Anomaly Detection Types
The engine detects 9 operational anomaly categories based on underlying project data:

| Anomaly Type | Category Code | Description | Underlying Data Source |
| :--- | :--- | :--- | :--- |
| **Speed Anomaly** | `SPEED_ANOMALY` | Corridor velocity exceeding safety thresholds or sudden acceleration surge | Telemetry speed (`speedKmH`) |
| **Route Deviation** | `ROUTE_DEVIATION` | Lateral vehicle displacement beyond corridor centerline buffer | GPS coordinates (`lat`, `lng`) vs corridor waypoints |
| **Long Stationary Stop** | `LONG_STATIONARY_STOP` (`LONG_STOP`) | Vehicle stationary outside designated boarding/alighting stops | Speed $\le 3\text{ km/h}$ & stop duration > threshold |
| **GPS Signal Drop** | `GPS_SIGNAL_DROP` (`GPS_SIGNAL_LOSS`) | Telemetry staleness indicating loss of GPS stream | Timestamp difference between ping & reference time |
| **Trip Operational Delay** | `UNEXPECTED_TRIP_DELAY` | Actual transit elapsed time exceeding scheduled arrival timeline | Actual vs scheduled ETA delta |
| **Unauthorized Dispatch** | `UNEXPECTED_TRIP_START` | Driver attempting dispatch departure before commuter verification | OTP verification manifest |
| **Failed OTP Attempts** | `MULTIPLE_FAILED_OTP` (`MULTIPLE_OTP_FAILURES`) | Repeated invalid passenger verification attempts | Boarding OTP retry counters |
| **Emergency SOS Alert** | `SOS_INCIDENT` | Active distress or emergency trigger dispatched by commuter or driver | SOS alert state |
| **Multi-Signal Correlation** | `MULTI_SIGNAL_ANOMALY` | Deterministic cross-signal correlation of 2+ concurrent active anomalies | Correlated active anomalies array |

---

## 4. Detection Rules & Numerical Thresholds

### 4.1 Speed Anomaly (`SPEED_ANOMALY`)
- **Corridor Expected Velocity**: $45\text{ km/h}$
- **Sudden Surge Spike**: $\Delta \text{speed} \ge 25\text{ km/h}$ over preceding reading with current speed $> 45\text{ km/h}$
- **Thresholds**:
  - $\ge 85\text{ km/h}$: **`CRITICAL`**
  - $\ge 70\text{ km/h}$: **`HIGH`**
  - $\ge 55\text{ km/h}$: **`MEDIUM`**
  - Sudden surge $\Delta \ge 25\text{ km/h}$ (under $55\text{ km/h}$): **`LOW`**

### 4.2 Route Corridor Deviation (`ROUTE_DEVIATION`)
- **Corridor Centroid Projection**: Perpendicular distance to closest waypoint segment using flat-earth projection with cosine latitude scaling.
- **Normal Buffer**: $\le 150\text{ meters}$ (exempt from alerting).
- **Thresholds**:
  - $> 800\text{ meters}$: **`CRITICAL`**
  - $> 300\text{ meters}$: **`HIGH`**
  - $> 150\text{ meters}$: **`MEDIUM`**
  - $> 100\text{ meters}$ and $\le 150\text{ meters}$: **`LOW`**

### 4.3 Long Stationary Stop (`LONG_STATIONARY_STOP` / `LONG_STOP`)
- **Stationary Velocity Cutoff**: $\le 3\text{ km/h}$
- **Designated Stop Exemption**: If distance to any scheduled corridor pickup/drop stop is $\le 150\text{ meters}$, vehicle is considered actively boarding/alighting commuters and **no alert is emitted**.
- **Thresholds Outside Designated Stops**:
  - $\ge 600\text{ seconds}$ (10 minutes): **`CRITICAL`**
  - $\ge 300\text{ seconds}$ (5 minutes): **`HIGH`**
  - $\ge 180\text{ seconds}$ (3 minutes): **`MEDIUM`**
  - $\ge 120\text{ seconds}$ (2 minutes): **`LOW`**

### 4.4 GPS Signal Loss & Staleness (`GPS_SIGNAL_DROP` / `GPS_SIGNAL_LOSS`)
- **Elapsed Time Since Last Ping**:
  - $\ge 120\text{ seconds}$: **`CRITICAL`** (total communication blackout)
  - $\ge 60\text{ seconds}$: **`HIGH`** (extended dead zone / hardware anomaly)
  - $\ge 30\text{ seconds}$: **`MEDIUM`** (moderate telemetry stall)
  - $\ge 15\text{ seconds}$: **`LOW`** (minor network latency)
  - $< 15\text{ seconds}$: Normal telemetry cadence

### 4.5 Operational Trip Delay (`UNEXPECTED_TRIP_DELAY`)
- **Calculated Delay**: $\text{Delay} = \max(0, \text{EstimatedETA} - \text{ScheduledETA})$ (or telemetry delay minutes)
- **Thresholds**:
  - $\ge 30\text{ minutes}$: **`CRITICAL`**
  - $\ge 15\text{ minutes}$: **`HIGH`**
  - $\ge 8\text{ minutes}$: **`MEDIUM`**
  - $\ge 4\text{ minutes}$: **`LOW`**
  - $< 4\text{ minutes}$: Normal traffic variance

### 4.6 Multi-Signal Anomaly Correlation (`MULTI_SIGNAL_ANOMALY`)
- When $\ge 2$ distinct non-correlated anomaly types are active simultaneously:
  - If concurrent signals include **`ROUTE_DEVIATION`** AND **`SPEED_ANOMALY`**: Classified as **`CRITICAL`** ("Aggressive Off-Corridor Velocity Surge").
  - Otherwise: Classified as **`HIGH`**.

---

## 5. Deduplication & Anti-Flooding Strategy
To prevent high-frequency telemetry polling loops from creating runaway duplicate database records:
1. **Deterministic Deduplication Key**:
   $$\text{dedupKey} = \text{tripId} + \text{":"} + \text{anomalyType}$$
2. **Stateful In-Flight Matching**:
   When evaluating incoming telemetry:
   - The engine checks `existingAnomalies` (or queried active records in `prisma.safetyEvent`) for any matching entry where `status === 'ACTIVE'` (or `INVESTIGATING` / `ACKNOWLEDGED`).
   - If an active match exists, the engine **preserves the original `id`** and original `detectedAt` timestamp.
   - It updates `lastDetectedAt = nowIso`, accumulates durations (`stoppedDurationSeconds`, `elapsedSecondsWithoutPing`), and updates the latest evidence values.
   - A new record is **only created** if no active anomaly of that type exists for the corridor.

---

## 6. API Architecture & RBAC Enforcement

### 6.1 Endpoints
- **`GET /api/security/anomalies`**: Fetches active operational anomalies, telemetry advisories, and evaluation metrics for a trip corridor.
- **`POST /api/security/anomalies`**: Evaluates telemetry payload against the engine and records active anomalies.
- **`POST /api/security/anomalies/detect`**: Dedicated anomaly detection evaluation endpoint returning structured evidence, counts, and severity summaries.
- **`GET /api/security/anomalies/detect`**: Live corridor evaluation endpoint.
- **`POST /api/security/anomalies/action`**: Incident triage endpoint (`ACKNOWLEDGE`, `INVESTIGATE`, `RESOLVE`, `DISMISS`).

### 6.2 Authorization Matrix
| Client Persona | `GET /api/security/anomalies` | `POST /api/security/anomalies/detect` | `POST /api/security/anomalies/action` |
| :--- | :--- | :--- | :--- |
| **Unauthenticated** | `401 Unauthorized` | `401 Unauthorized` | `403 Forbidden` |
| **Guest (`?mode=guest`)** | `401 Unauthorized` | `401 Unauthorized` | `403 Forbidden` |
| **Commuter** | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` |
| **Driver** | `200 OK` (own operational advisories) | `200 OK` (assigned corridor) | `403 Forbidden` |
| **Admin** | `200 OK` (full SOC intelligence) | `200 OK` (full evaluation) | `200 OK` (triage actions) |

---

## 7. Integration with Route Risk Scoring (Step 1)
The anomaly detection layer cleanly feeds the Route Risk Scoring engine created in Step 1:
```
Vehicle Telemetry Feed / Polling
               ↓
    detectAnomalies(input)
               ↓
  prisma.safetyEvent.upsert()
               ↓
calculateRouteRiskScore({ route, events })
               ↓
Authoritative Route Risk Score (0 - 100)
```
- Active deviations increment route risk by **+15 pts** (up to 30 pts).
- Active speeding anomalies increment route risk by **+10 pts** (up to 20 pts).
- Stationary stops and GPS drops increment route risk by **+8 pts** (up to 16 pts).
- Emergency SOS alerts increment route risk by **+35 pts** (up to 50 pts).
- Resolving an anomaly via `/api/security/anomalies/action` dampens its risk contribution to **+2 pts** historical weight.

---

## 8. Admin Security Center Integration
The Admin Security Center (`/admin/security`) hosts:
1. **`<RouteRiskOverview />`**: Corridor risk cards, risk levels, and score bars.
2. **`<AnomalyMonitoringCenter />`**: Real-time operational anomaly detection grid, severity pills, evidence metrics modal, simulation testing, and incident resolution workflows.
3. **`<SecurityCenterDashboard />`**: Security posture dial, authentication auditing, and SIEM CSV/JSON exports.

---

## 9. Verification & Regression Coverage
- **`verify_step12.mjs`**: 18/18 Tests Passed (100%)
  - Unauthenticated rejection (401)
  - Commuter access denial (403)
  - Admin access authorization (200)
  - Deterministic evaluation on clean input
  - Speed anomaly detection at threshold
  - Route deviation detection outside corridor
  - Long stationary stop detection outside scheduled stops
  - GPS signal drop detection with staleness gap
  - Multi-tier deterministic severity classification
  - Anti-flooding deduplication
  - Incident resolution action verification
  - Route risk score recalculation
  - Route discovery regression
  - Commuter subscription regression
  - Driver onboarding/roster regression
  - Admin metrics regression
  - Guest bypass protection
- **`verify_step11.mjs`**: 16/16 Passed
- **`verify_step10.mjs`**: 8/8 Passed
- **`verify_step9.mjs`**: 12/12 Passed
- **`verify_step8.mjs`**: 12/12 Passed
- **`npm run build`**: Exit Code 0 (0 errors)

---

## 10. Known Limitations & Technical Debt
1. **Dynamic Waypoint Ingestion**: Waypoints are currently standardized on tech corridors (e.g. `SR101_CORRIDOR_WAYPOINTS`). Multi-route waypoint arrays from Firestore routes should be seamlessly passed into the engine per trip.
2. **Turn-by-Turn GPS Polyline Matching**: Perpendicular vector projection is utilized on waypoint-to-waypoint segments. Complex multi-node curves currently approximate perpendicular distances across adjacent waypoints.

---

## 11. Future Roadmap
- **Phase 3 Step 3**: Predictive Delay Detection (ML / historical ETA models).
- **Automated Standby Dispatch**: Link critical `LONG_STATIONARY_STOP` or `GPS_SIGNAL_DROP` events directly to automated standby driver coverage recommendations.
