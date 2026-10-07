# Smart Commute Intelligence — Route Risk History & Trend Analysis

## 1. Executive Summary
Phase 3 Step 2 establishes the **Route Risk History and Deterministic Trend Analysis Engine** for the SmartRide platform. Building directly upon the point-in-time Route Risk Score introduced in Step 1, this module provides chronological snapshot persistence and descriptive trend detection without synthetic data or speculative probabilistic models. 

Transit dispatchers and security operations center (SOC) admins can now track corridor risk changes over time, identify safety degradation or improvements, view factor-by-factor deltas, and review interactive Recharts telemetry curves directly in `/admin/security`.

---

## 2. Architecture & Data Model

### Persistence Strategy
Historical snapshots are persisted to the SQLite database via Prisma (`RouteRiskSnapshot`), with a synchronized high-performance in-memory fallback layer (`inMemorySnapshotStore`) to guarantee zero-downtime availability and resilience against transient database locks.

### Prisma Schema (`prisma/schema.prisma`)
```prisma
model RouteRiskSnapshot {
  id                   String   @id @default(uuid())
  routeId              String
  routeCode            String
  routeName            String
  riskScore            Int
  riskLevel            String   // LOW, MEDIUM, HIGH, CRITICAL
  emergencyPoints      Int      @default(0)
  deviationPoints      Int      @default(0)
  speedPoints          Int      @default(0)
  stopGpsPoints        Int      @default(0)
  compliancePoints     Int      @default(0)
  complexityPoints     Int      @default(0)
  totalEvents          Int      @default(0)
  activeEmergencies    Int      @default(0)
  activeDeviations     Int      @default(0)
  activeSpeedAnomalies Int      @default(0)
  stopGpsEvents        Int      @default(0)
  driverVerified       Boolean  @default(true)
  vehicleApproved      Boolean  @default(true)
  factorsJson          String?  // Serialized RouteRiskFactor[] breakdown
  metricsJson          String?  // Serialized incident metrics
  evaluatedAt          DateTime @default(now())

  @@index([routeId])
  @@index([evaluatedAt])
}
```

---

## 3. Factor Level Points & Incident Metrics Breakdown
Each historical snapshot records the point-in-time calculation across the 6 core safety dimensions:
1. **Emergency Points (`emergencyPoints`)**: Points accumulated from active passenger SOS alerts or emergency safety events (+35 pts per active SOS, capped at 50).
2. **Deviation Points (`deviationPoints`)**: Points accumulated from off-corridor diversions (+15 pts active, +2 pts recent resolved, capped at 35).
3. **Speed Points (`speedPoints`)**: Points from corridor speed surge violations (+10 pts active, +2 pts recent resolved, capped at 24).
4. **Stop & GPS Points (`stopGpsPoints`)**: Points from unauthorized long stops and telemetry loss (+8 pts active, capped at 16).
5. **Compliance Points (`compliancePoints`)**: Missing driver KYC (+15 pts) and unapproved vehicle inspection (+10 pts).
6. **Complexity Points (`complexityPoints`)**: High corridor stop density and route length (>25 km and $\ge 5$ waypoints: +5 pts).

---

## 4. Deterministic Trend Analysis Engine

### Mathematical Formulations
Let $S = [s_1, s_2, \dots, s_n]$ be the sequence of chronological snapshots for route $R$ ordered ascending by timestamp ($t_1 \le t_2 \le \dots \le t_n$).

- If $n < 2$:
  $$\text{Trend}(S) = \mathbf{NO\_HISTORY}$$
  $$\Delta \text{Score} = \text{null}$$
  Summary: *"Insufficient history: At least 2 snapshots are required to evaluate safety trends."*

- If $n \ge 2$:
  Let $s_{\text{curr}} = s_n$ (most recent snapshot) and $s_{\text{prev}} = s_{n-1}$ (immediately preceding snapshot).
  $$\Delta \text{Score} = s_{\text{curr}}.\text{riskScore} - s_{\text{prev}}.\text{riskScore}$$

### Trend Classification Rules
$$\text{Trend}(S) = \begin{cases} 
\mathbf{RISING} & \text{if } \Delta \text{Score} > 0 \\ 
\mathbf{FALLING} & \text{if } \Delta \text{Score} < 0 \\ 
\mathbf{STABLE} & \text{if } \Delta \text{Score} = 0 
\end{cases}$$

### Factor Deltas
$$\Delta \text{Factor}_i = s_{\text{curr}}.\text{Factor}_i - s_{\text{prev}}.\text{Factor}_i \quad \forall i \in \{\text{emergency}, \text{deviation}, \text{speed}, \text{stopGps}, \text{compliance}, \text{complexity}\}$$

This provides deterministic explainability. If a route transitions from `STABLE` to `RISING` by $+15$ points, the dispatcher immediately sees that $\Delta \text{deviationPoints} = +15$ rather than an opaque black-box AI score.

---

## 5. Anti-Forgery & Server-Side Derivation Security
All snapshots must be strictly derived on the server side:
- **No Client-Supplied Scores**: The `POST /api/safety/route-risk/history` endpoint accepts only `{ routeId: string }`.
- Any client-submitted `riskScore`, `riskLevel`, `emergencyPoints`, or `factors` in the request body are strictly ignored and discarded.
- The server retrieves verified route configuration, live safety events, driver KYC, and vehicle documents using `calculateRouteRiskScore(routeId)` and persists the resulting server-computed metrics.
- Tamper attempts are prevented by design (verified in Test 3 and Test 4 of `scratch/verify_step12.mjs`).

---

## 6. API Specifications

### 1. `POST /api/safety/route-risk/history`
Records an instantaneous risk snapshot for the specified route corridor.
- **Authorization**: `ADMIN` role required.
- **Request Body**:
  ```json
  {
    "routeId": "route-sr-101"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Route risk snapshot recorded successfully",
    "snapshot": {
      "id": "uuid-...",
      "routeId": "route-sr-101",
      "routeCode": "SR-101",
      "routeName": "Electronic City Express",
      "riskScore": 5,
      "riskLevel": "LOW",
      "emergencyPoints": 0,
      "deviationPoints": 0,
      "speedPoints": 0,
      "stopGpsPoints": 0,
      "compliancePoints": 0,
      "complexityPoints": 5,
      "totalEvents": 0,
      "evaluatedAt": "2026-09-30T11:30:00.000Z"
    }
  }
  ```

### 2. `GET /api/safety/route-risk/history?routeId=<id>&limit=<n>`
Retrieves chronological snapshots and the deterministic trend analysis.
- **Authorization**: `ADMIN` role required.
- **Query Parameters**:
  - `routeId` (required): Route UUID or code (e.g. `route-sr-101` or `SR-101`).
  - `limit` (optional): Maximum snapshots to retrieve (default: 50).
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 2,
    "route": {
      "id": "route-sr-101",
      "code": "SR-101",
      "name": "Electronic City Express"
    },
    "trendAnalysis": {
      "trend": "STABLE",
      "currentScore": 5,
      "previousScore": 5,
      "scoreDelta": 0,
      "currentLevel": "LOW",
      "previousLevel": "LOW",
      "factorDeltas": {
        "emergencyPoints": 0,
        "deviationPoints": 0,
        "speedPoints": 0,
        "stopGpsPoints": 0,
        "compliancePoints": 0,
        "complexityPoints": 0
      },
      "summary": "Corridor risk is STABLE (score: 5, Δ 0). Key contributing factors remain consistent with previous evaluation."
    },
    "snapshots": [...]
  }
  ```

---

## 7. Role-Based Access Control (RBAC) Matrix

| Endpoint | Unauthenticated | Commuter | Driver | Admin |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/safety/route-risk/history` | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **200 OK** |
| `POST /api/safety/route-risk/history` | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **200 OK** |

All requests are validated server-side using `verifySession()` from `@/lib/auth/session-server`. Tampered cookie headers or forged credentials fail immediately.

---

## 8. Admin UI: RouteRiskHistoryViewer

Located at `src/components/admin/route-risk-history-viewer.tsx` and embedded in `src/app/admin/security/page.tsx`, the component includes:
1. **Corridor Route Selector**: Dropdown to switch seamlessly across all active transit routes.
2. **Snapshot Capture Trigger**: Instant "Capture Snapshot" button invoking `POST /api/safety/route-risk/history`.
3. **KPI Metrics Cards**:
   - **Current Score & Level**: Shows latest score with color-coded badge.
   - **Previous Score**: Preceding snapshot score.
   - **Score Delta ($\Delta$)**: Net shift (+ / - / 0).
   - **Trend Direction**: Badge displaying `RISING`, `FALLING`, `STABLE`, or `NO_HISTORY`.
4. **Descriptive Narrative Banner**: Clear operational explanation of the current trend.
5. **Factor Delta Breakdown**: Six dimension cards indicating specific point shifts ($\Delta$ Emergency, $\Delta$ Deviation, $\Delta$ Speed, $\Delta$ Stops/GPS, $\Delta$ Compliance, $\Delta$ Complexity).
6. **Chronological Snapshot Audit Table**: Timestamps, scores, levels, event counts, and driver/vehicle status.

---

## 9. Recharts Visualization Integration
The historical trend is visualized using Recharts `LineChart`:
- **Y-Axis**: Strictly bounded 0 to 100 to prevent misleading visual distortion.
- **Reference Lines**: 
  - `y = 25` (Amber - Medium threshold)
  - `y = 50` (Orange - High threshold)
  - `y = 75` (Rose - Critical threshold)
- **Zero Mock / Synthetic Line Rule**: If $n < 2$, the chart gracefully displays an informative alert: *"Insufficient history: At least 2 snapshots are required to plot trend line"*. No fake linear slopes are generated.

---

## 10. Verification & Test Suite Summary (`verify_step12.mjs`)
The Step 12 verification test suite (`scratch/verify_step12.mjs`) executed 21 comprehensive tests with **100% pass rate**:

```
=== STARTING STEP 12 ROUTE RISK HISTORY & TREND TEST SUITE ===
================== TEST RESULTS ==================
✔ TEST 1: Admin can create snapshot via POST (200): PASSED
✔ TEST 2: Snapshot contains server-calculated risk score & factor points: PASSED
✔ TEST 3: Client cannot supply a fake riskScore (anti-forgery): PASSED
✔ TEST 4: Client cannot supply a fake riskLevel (anti-forgery): PASSED
✔ TEST 5: Unauthenticated history request rejected (401): PASSED
✔ TEST 6: Commuter history request rejected (403): PASSED
✔ TEST 7: Driver history request rejected (403): PASSED
✔ TEST 8: Admin history request allowed (200): PASSED
✔ TEST 9: Route-specific history returns only that route's snapshots: PASSED
✔ TEST 10: Historical snapshots are ordered chronologically: PASSED
✔ TEST 11: Trend calculation: RISING when score increases: PASSED
✔ TEST 12: Trend calculation: FALLING when score decreases: PASSED
✔ TEST 13: Trend calculation: STABLE when consecutive scores are equal: PASSED
✔ TEST 14: No historical data / 1 snapshot yields NO_HISTORY: PASSED
✔ TEST 15: Nonexistent route returns 404 on POST and GET: PASSED
✔ TEST 16: Existing Step 1 Route Risk API remains fully functional: PASSED
✔ TEST 17: Admin Security page loads successfully with RouteRiskHistoryViewer: PASSED
✔ TEST 18: Existing authentication for all roles verified: PASSED
✔ TEST 19: Commuter route discovery remains fully operational: PASSED
✔ TEST 20: Commuter subscription/booking flow verified: PASSED
✔ TEST 21: Factor deltas accurately capture changes across all 6 safety dimensions: PASSED

TOTAL: 21/21 PASSED
```

---

## 11. Regression Testing Results
All prior stabilization and intelligence suites remain 100% green:
- `verify_step11.mjs`: **16/16 PASSED** (Step 1 Route Risk API & factors)
- `verify_step10.mjs`: **8/8 PASSED** (Final Phase 1 stabilization audit)
- `verify_step9.mjs`: **12/12 PASSED** (Commuter data isolation & ID tampering prevention)
- `verify_step8.mjs`: **12/12 PASSED** (Route creation, selection & booking flow)
- `npm run build`: **Exit Code 0** (0 TypeScript errors, 36/36 static pages compiled)

---

## 12. Operational Runbook & Maintenance Guide
1. **Periodic Snapshot Captures**:
   - Admins can capture snapshots manually via the Security Center UI.
   - For automated platform jobs, a cron runner or background worker can trigger `recordRouteRiskSnapshot(routeId)` periodically (e.g. hourly or upon trip closure).
2. **Database Maintenance**:
   - The `RouteRiskSnapshot` table includes composite indexes on `routeId` and `evaluatedAt`.
   - Retention policy recommendation: Retain high-resolution snapshots for 90 days; older snapshots can be aggregated or archived as needed.
3. **Emergency Alert Handling**:
   - Whenever an SOS event is triggered or resolved in the platform, taking an immediate snapshot provides auditable before-and-after proof of corridor risk resolution.
