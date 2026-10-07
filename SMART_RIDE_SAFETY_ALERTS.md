# Smart Commute Intelligence — Operational Safety Alert Engine

> **Notice:** This Step 3 alert engine is deterministic and descriptive. It does not predict future safety incidents.

---

## 1. Purpose
The Operational Safety Alert Engine represents Phase 3, Step 3 of the SmartRide platform. It converts continuous, deterministic Route Risk Scores (Step 1) and historical snapshot trends (Step 2) into clear, actionable operational safety alerts for Central Dispatch and the Security Operations Center (SOC).

The engine answers the core operational question: **"Does the current corridor safety state require immediate Admin/SOC attention?"**

---

## 2. Architecture
The architecture operates strictly as a unidirectional deterministic evaluation pipeline:

```
Current Route Risk (Step 1)
        +
Previous Route Risk Snapshot (Step 2)
        +
Factor-by-Factor Deltas (Step 2)
        +
Incident Telemetry & Compliance
        ↓
Deterministic Alert Rules (Rules A – I)
        ↓
Deterministic Deduplication Filter
        ↓
SQLite Persistence (`SafetyAlert` Model) + In-Memory Fallback Cache
        ↓
Admin SOC Security Center UI (`SafetyAlertCenter`)
```

- **Zero Black-Box AI / ML**: Alerts are derived strictly using mathematical thresholds and Boolean invariants.
- **Zero LLM-Generated Text**: Every title, message, and evidence item is generated from fixed, deterministic format strings.
- **Dual-Layer Resilience**: Alerts are stored in SQLite via Prisma (`SafetyAlert`) and mirrored in an in-memory cache to guarantee zero downtime or data loss during transient database contention.

---

## 3. Deterministic Alert Rules

| Rule | Alert Type | Trigger Condition | Severity | Description / Evidence |
| :--- | :--- | :--- | :---: | :--- |
| **Rule A** | `CRITICAL_RISK` | $\text{riskScore} \ge 75$ | `CRITICAL` | Severe corridor danger; immediate central dispatch intervention required. |
| **Rule B** | `HIGH_RISK` | $50 \le \text{riskScore} < 75$ | `HIGH` | Elevated corridor risk; operational monitoring and route audit advised. |
| **Rule C** | `RAPID_RISK_INCREASE` | $\Delta \text{Score} \ge 15$ | `CRITICAL` ($\ge 25$)<br>`HIGH` ($\ge 15$) | Sharp risk surge between consecutive snapshot evaluations. |
| **Rule D** | `RISK_LEVEL_ESCALATION` | $\text{Level}_{\text{curr}} > \text{Level}_{\text{prev}}$ | Matching Level | Safety tier escalated upward (e.g. LOW $\to$ MEDIUM, MEDIUM $\to$ HIGH, HIGH $\to$ CRITICAL). |
| **Rule E** | `ACTIVE_EMERGENCY` | $\text{activeEmergencies} > 0$ | `CRITICAL` | Open passenger panic (SOS) alerts or active platform emergency protocol. |
| **Rule F** | `ACTIVE_ROUTE_DEVIATION` | $\text{activeDeviations} > 0$ | `HIGH` | Active off-corridor vehicle diversion requiring navigation verification. |
| **Rule G** | `ACTIVE_SPEED_ANOMALY` | $\text{activeSpeedAnomalies} > 0$ | `HIGH` | Active speed limit violation exceeding corridor safety parameters. |
| **Rule H** | `COMPLIANCE_FAILURE` | $\text{driverVerified} = \text{false} \lor \text{vehicleApproved} = \text{false}$ | `HIGH` | Unverified driver assigned or vehicle inspection approval missing/pending. |
| **Rule I** | `MULTI_FACTOR_DETERIORATION` | $\ge 3$ factor points increased | `HIGH` | Compound safety decay across three or more distinct risk dimensions simultaneously. |

---

## 4. Severity Mapping

Alerts are mapped to four standardized severity classifications:

1. **`CRITICAL`** (Red/Rose Badge):
   - `CRITICAL_RISK` ($\text{score} \ge 75$)
   - `ACTIVE_EMERGENCY` ($\text{activeEmergencies} > 0$)
   - `RAPID_RISK_INCREASE` ($\Delta \text{Score} \ge 25$)
   - `RISK_LEVEL_ESCALATION` (escalation resulting in `CRITICAL`)

2. **`HIGH`** (Orange Badge):
   - `HIGH_RISK` ($50 \le \text{score} < 75$)
   - `RAPID_RISK_INCREASE` ($15 \le \Delta \text{Score} < 25$)
   - `ACTIVE_ROUTE_DEVIATION` ($\text{activeDeviations} > 0$)
   - `ACTIVE_SPEED_ANOMALY` ($\text{activeSpeedAnomalies} > 0$)
   - `COMPLIANCE_FAILURE` (driver unverified or vehicle unapproved)
   - `MULTI_FACTOR_DETERIORATION` ($\ge 3$ factor points increased)
   - `RISK_LEVEL_ESCALATION` (escalation resulting in `HIGH`)

3. **`MEDIUM`** (Amber Badge):
   - `RISK_LEVEL_ESCALATION` (escalation resulting in `MEDIUM`, e.g. LOW $\to$ MEDIUM)

4. **`LOW`** (Emerald/Slate Badge):
   - Informational baseline conditions.

---

## 5. Data Sources
All alert evaluations are calculated exclusively from verified platform sources:
- **`prisma.routeRiskSnapshot`**: Evaluated snapshot scores, levels, factor breakdowns, and incident tallies.
- **`src/lib/safety/route-risk-engine.ts`**: Step 1 deterministic risk calculator.
- **`src/lib/safety/route-risk-history-store.ts`**: Step 2 chronological snapshot storage and trend analyzer.
- **`FirestoreDriverProfile` & `FirestoreVehicle`**: Live driver KYC verification and vehicle inspection approval statuses.

---

## 6. API Contracts

### 1. `GET /api/safety/alerts`
Retrieves paginated and filtered safety alerts with KPI summary.
- **Access**: `ADMIN` only.
- **Query Parameters**:
  - `routeId` (optional): Filter by corridor ID or route code.
  - `severity` (optional): `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.
  - `status` (optional): `ACTIVE`, `RESOLVED`.
  - `limit` (optional): Maximum records (default 100, max 500).
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "count": 4,
    "alerts": [
      {
        "id": "alert_1790750...",
        "routeId": "route-sr-101",
        "routeCode": "SR-101",
        "routeName": "Electronic City Express",
        "type": "COMPLIANCE_FAILURE",
        "severity": "HIGH",
        "title": "Operational Compliance Failure: SR-101",
        "message": "Route SR-101 compliance verification failed: assigned driver verification is incomplete/unverified.",
        "currentScore": 25,
        "previousScore": null,
        "scoreDelta": null,
        "evidence": {
          "driverVerified": false,
          "vehicleApproved": true,
          "compliancePoints": 15
        },
        "status": "ACTIVE",
        "triggeredAt": "2026-09-30T11:40:00.000Z",
        "resolvedAt": null,
        "resolvedBy": null
      }
    ],
    "summary": {
      "total": 4,
      "critical": 1,
      "high": 3,
      "medium": 0,
      "low": 0,
      "active": 4,
      "resolved": 0
    }
  }
  ```

### 2. `POST /api/safety/alerts/evaluate`
Triggers server-side evaluation of safety alert rules for a specific route.
- **Access**: `ADMIN` only.
- **Request Body**:
  ```json
  {
    "routeId": "route-sr-101"
  }
  ```
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Route safety alerts evaluated successfully",
    "route": {
      "id": "route-sr-101",
      "code": "SR-101",
      "name": "Electronic City Express"
    },
    "generatedCount": 1,
    "alerts": [...],
    "summary": { ... }
  }
  ```

### 3. `POST /api/safety/alerts/[id]/resolve`
Resolves an active safety alert.
- **Access**: `ADMIN` only.
- **Response Structure (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Safety alert resolved successfully",
    "alert": {
      "id": "alert_1790750...",
      "status": "RESOLVED",
      "resolvedAt": "2026-09-30T11:41:00.000Z",
      "resolvedBy": "admin@smartride.com"
    }
  }
  ```

---

## 7. Role-Based Access Control (RBAC) Matrix

| Endpoint | Unauthenticated | Commuter | Driver | Admin |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/safety/alerts` | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **200 OK** |
| `POST /api/safety/alerts/evaluate` | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **200 OK** |
| `POST /api/safety/alerts/[id]/resolve` | **401 Unauthorized** | **403 Forbidden** | **403 Forbidden** | **200 OK** |

All endpoints validate session tokens via `getSessionFromRequest(req)` using signed HMAC-SHA256 JWTs. Commuters and Drivers are strictly forbidden from viewing or triggering platform safety alerts.

---

## 8. Anti-Forgery & Server-Side Derivation
- The client cannot supply `riskScore`, `riskLevel`, `previousScore`, `severity`, `type`, or `evidence`.
- The evaluation endpoint accepts strictly `{ routeId: string }`.
- Any tampered fields submitted in the request body are discarded and never persisted (verified in Tests 9–13 of `verify_step13.mjs`).
- Timestamps (`triggeredAt`, `resolvedAt`) are stamped exclusively by the server runtime.

---

## 9. Deduplication Behavior
To avoid alert storms from repeated evaluations:
1. **Deduplication Key (`dedupKey`)**:
   - Current-state alerts: `${routeId}:${type}:${snapshotId}`
   - Historical comparative alerts: `${routeId}:${type}:${prevSnapshotId}:${currSnapshotId}`
2. **Open Ticket Protection**: If an alert of the same `type` for the same corridor `routeId` is already in `ACTIVE` status with identical trigger metrics, duplicate rows are prevented.

---

## 10. Resolution Lifecycle
- Alerts start in `ACTIVE` status.
- Once an operator or dispatcher investigates the issue, they click "Resolve Alert" in the UI.
- The server sets `status = 'RESOLVED'`, stamps `resolvedAt = new Date()`, and records `resolvedBy` with the admin user's identity.
- Resolved alerts can be audited at any time using the `?status=RESOLVED` filter.

---

## 11. Admin UI: Safety Alert Center
Located at `src/components/admin/safety-alert-center.tsx` and embedded in `src/app/admin/security/page.tsx`:
1. **Corridor Route Filter**: Dropdown allowing filtering by all routes or a single corridor.
2. **"Evaluate Safety Alerts" Action**: Real-time evaluation button with loading spinner feedback.
3. **5 Top KPI Cards**: Active Alerts, Critical, High, Medium, and Resolved counts.
4. **Filter Tabs**: Quick toggling between ALL, ACTIVE, CRITICAL, HIGH, MEDIUM, LOW, and RESOLVED.
5. **Interactive Alert Cards**:
   - Severity badges with iconography.
   - Title, route code badge, and score delta tag.
   - Plain-English operational narrative.
   - Expandable "View Evidence" drawer showing checklist of verifiable data triggers.
   - "Resolve Alert" button with confirmation feedback.

---

## 12. Verification & Regression Test Summary

### Step 13 Test Suite (`scratch/verify_step13.mjs`): **30/30 PASSED**
- TEST 1: Admin can retrieve alerts (GET 200) — **PASSED**
- TEST 2: Unauthenticated alert GET rejected (401) — **PASSED**
- TEST 3: Commuter alert GET rejected (403) — **PASSED**
- TEST 4: Driver alert GET rejected (403) — **PASSED**
- TEST 5: Admin can evaluate a route (POST 200) — **PASSED**
- TEST 6: Unauthenticated evaluation rejected (401) — **PASSED**
- TEST 7: Commuter evaluation rejected (403) — **PASSED**
- TEST 8: Driver evaluation rejected (403) — **PASSED**
- TEST 9: Client cannot forge riskScore — **PASSED**
- TEST 10: Client cannot forge riskLevel — **PASSED**
- TEST 11: Client cannot forge severity — **PASSED**
- TEST 12: Client cannot forge alert type — **PASSED**
- TEST 13: Client cannot forge evidence — **PASSED**
- TEST 14: Nonexistent route returns 404 — **PASSED**
- TEST 15: Admin can resolve an alert (POST 200) — **PASSED**
- TEST 16: Unauthenticated resolve rejected (401) — **PASSED**
- TEST 17: Commuter resolve rejected (403) — **PASSED**
- TEST 18: Driver resolve rejected (403) — **PASSED**
- TEST 19: Resolved alert receives resolvedAt timestamp — **PASSED**
- TEST 20: Duplicate evaluation does not create duplicate alerts — **PASSED**
- TEST 21: CRITICAL risk generates CRITICAL alert (Rule A) — **PASSED**
- TEST 22: Active emergency generates CRITICAL alert (Rule E) — **PASSED**
- TEST 23: Active deviation generates HIGH alert (Rule F) — **PASSED**
- TEST 24: Active speed anomaly generates HIGH alert (Rule G) — **PASSED**
- TEST 25: Compliance failure generates HIGH alert (Rule H) — **PASSED**
- TEST 26: Multi-factor deterioration generates HIGH alert (Rule I) — **PASSED**
- TEST 27: Risk escalation correctly detected (Rule D) — **PASSED**
- TEST 28: Rapid risk increase correctly detected (Rule C) — **PASSED**
- TEST 29: Existing Step 1 Route Risk API remains fully operational — **PASSED**
- TEST 30: Existing Step 2 Route Risk History API remains fully operational — **PASSED**

### Regression Test Suites
- `verify_step12.mjs`: **21/21 PASSED** (Step 2 Route Risk History & Trend)
- `verify_step11.mjs`: **16/16 PASSED** (Step 1 Route Risk Score)
- `verify_step10.mjs`: **8/8 PASSED** (Phase 1 Stabilization Audit)
- `npm run build`: **Exit Code 0** (36/36 static pages, 0 TypeScript errors)

---

## 13. Limitations & Future Extension Points
1. **Descriptive Scope**: The engine triggers strictly on current and historical telemetry changes. It does not predict future route accidents or speculative delays.
2. **Future Automated Webhooks**: External incident notification (e.g. SMS, PagerDuty, or Slack dispatch alerts) can be tied directly to the `createSafetyAlert` hook in subsequent operational phases.
