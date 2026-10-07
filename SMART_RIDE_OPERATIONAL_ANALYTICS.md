# SmartRide Operational Intelligence Analytics & Executive Reporting Center (Phase 3 — Step 10)

## 1. Objective
The **Smart Commute Operational Intelligence Analytics & Executive Reporting Center** transforms the deterministic, verified operational intelligence generated across Phase 3 (Steps 1 through 9) into a unified, historical, explainable, and executive-level analytics and decision-support layer.

The module answers core administrative questions:
- *What has been happening operationally over time across the SmartRide network?*
- *Where are recurring risks, capacity pressures, or governance anomalies congregating?*
- *What deterministic trends are emerging across active transit corridors?*
- *What verified evidence, audit trails, and concrete telemetry support executive decisions?*

### Mandatory Safety and Advisory Invariants
- **Strictly Read-Only and Advisory**: The analytics engine performs purely analytical computations and aggregates historical records. It **never** triggers automated dispatch, route modifications, driver reassignments, trip state shifts, schedule variations, or subscription adjustments.
- **Zero Generative Guesswork**: No probabilistic language models, generative AI hallucinations, or speculative scoring algorithms are utilized. All insights, metrics, and trends are mathematically derived and cross-referenced against authoritative server repositories.
- **Human Authority**: The Administrator maintains total authority. Operational actions remain strictly human-in-the-loop.

---

## 2. Architecture
The Operational Analytics subsystem sits directly above the verified operational intelligence repositories established across Steps 1 through 9:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Admin Security Center: Operational Analytics                │
│            (Executive KPIs, Corridors, Insights, Visualizations)             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REST API: /api/operations/analytics                     │
│                (RBAC: ADMIN only, Windows, Route Filters, Audit)            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Operational Analytics Engine                          │
│   (Time Window Resolution, Multi-Corridor Aggregation, Pattern Detection)  │
└──────┬────────────┬─────────────┬──────────────┬─────────────┬──────────────┘
       │            │             │              │             │
       ▼            ▼             ▼              ▼             ▼
┌────────────┐┌────────────┐┌────────────┐┌─────────────┐┌────────────┐
│ Step 1 & 2 ││   Step 3   ││   Step 4   ││   Step 5    ││ Step 8 & 9 │
│ Route Risk ││   Safety   ││  Incident  ││ AI / Demand ││   Audit &  │
│ & History  ││   Alerts   ││ Management ││  Telemetry  ││ Governance │
└────────────┘└────────────┘└────────────┘└─────────────┘└────────────┘
```

The system operates across three tightly integrated tiers:
1. **Analytics Engine Core (`src/lib/operations/operational-analytics-engine.ts`)**: Server-authoritative computation routines that resolve time windows, filter repositories, compute corridor trajectories, detect recurring patterns, generate deterministic evidence-backed insights, compile corridor health profiles, and produce print-ready executive reports.
2. **API Layer (`src/app/api/operations/analytics/route.ts`)**: Secure, authenticated HTTP interface enforcing HMAC-SHA256 JWT validation, ADMIN-only role authorization, input sanitization, and strict 405 Method Not Allowed guards against all mutation verbs (`POST`, `PUT`, `PATCH`, `DELETE`).
3. **Executive UI Component (`src/components/admin/operational-analytics-center.tsx`)**: High-density React interface embedded within the Platform SOC (`/admin/security`) featuring 8 executive KPI cards, time-window selectors, responsive Recharts visualizations, corridor comparison matrices, drill-down drawers, and printable executive reports.

---

## 3. Data Sources
The analytics engine synthesizes exclusively verified, persisted data from prior Phase 3 steps:
1. **Prisma SQLite Route Repository (`prisma.route`)**: Authorized transit routes (`SR-101`, `SR-102`, `SR-103`), waypoint coordinates, assigned drivers, and assigned vehicles.
2. **Route Risk Snapshot Store (`src/lib/safety/route-risk-history-store.ts`)**: Chronological risk snapshots evaluated across 6 deterministic safety dimensions.
3. **Operational Safety Alert Store (`src/lib/safety/operational-safety-alert-store.ts`)**: Server-generated safety alerts across severity levels (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) and operational states (`ACTIVE`, `RESOLVED`).
4. **Safety Incident Repository (`src/lib/safety/safety-incident-store.ts`)**: Incident case files, severities, lifecycles (`OPEN`, `INVESTIGATING`, `RESOLVED`, `CLOSED`), and investigation notes.
5. **Demand Telemetry Repository (`src/lib/ai/historical-demand-store.ts`)**: Passenger ridership telemetry, pickup distributions, and booking density.
6. **Operational Recommendation Store (`src/lib/operations/recommendation-store.ts`)**: Human-in-the-loop action plans, priorities, lifecycles (`PENDING`, `APPROVED`, `DISMISSED`, `COMPLETED`), and approval timestamps.
7. **Operational Governance Engine (`src/lib/operations/governance-engine.ts`)**: Deterministic compliance evaluations, governance exceptions, and route statuses.
8. **Operational Action Audit Store (`src/lib/operations/operational-audit-store.ts`)**: Cryptographically hashed (SHA-256) audit logs providing continuous chain validation.

---

## 4. Time Windows
Deterministic time-window filtering ensures temporal reproducibility:
- **`LAST_24_HOURS`**: Real-time intraday operational analysis ($duration = 24$ hours).
- **`LAST_7_DAYS`** (*Default*): Operational week view capturing commuting cycles ($duration = 168$ hours).
- **`LAST_30_DAYS`**: Monthly strategic planning window ($duration = 720$ hours).
- **`LAST_90_DAYS`**: Quarterly governance and compliance review window ($duration = 2160$ hours).
- **`CUSTOM`**: Custom historical bounds with strict chronological validation ($from < to$ enforced; invalid ranges return HTTP 400).

Every analytics calculation filters historical records such that $timestamp \ge window.from$ and $timestamp \le window.to$.

---

## 5. Risk Analytics
Historical corridor and fleet risk metrics are computed server-side:
- **Fleet Average Risk Score**: Mean deterministic score of all route snapshots recorded within the active time window.
- **Corridor Extreme Values**: Minimum and maximum observed risk scores.
- **Trajectory Trend**: Categorized as `RISING`, `FALLING`, `STABLE`, or `NO_HISTORY` based on chronological delta calculations ($\Delta = score_{latest} - score_{earliest}$).
- **Risk Factor Breakdown**: Frequency distribution of activated risk factors across corridors (e.g., Transit Complexity, Weather Hazards, Speed Anomalies, Off-Route Deviations).

---

## 6. Alert Analytics
Authoritative aggregation of operational safety alerts:
- **Total Alerts**: Verified count of safety events within the selected window.
- **Severity Distribution**: Categorization across `CRITICAL`, `HIGH`, `MEDIUM`, and `LOW`.
- **Resolution Performance**: Calculated resolution rate ($rate = \frac{resolved}{total} \times 100\%$).
- **Resolution Latency**: Mean time in minutes from alert trigger to formal resolution.
- **Temporal Frequency**: Average alert generation rate per operational day.

---

## 7. Incident Analytics
Incident case management and tracking:
- **Case Lifecycle Distribution**: Breakdown across `OPEN`, `RESOLVED`, and `CLOSED`.
- **Severity Classification**: Case counts by severity.
- **Resolution Latency**: Average time required to investigate and resolve formal cases.
- **Repeat Incident Corridors**: Corridors with $\ge 2$ recorded incidents within the window, flagged for administrative inspection.

---

## 8. Demand Analytics
Smart commute capacity and ridership evaluation:
- **Average & Peak Occupancy**: Mean and highest seat utilization percentages.
- **High / Critical Demand Occurrences**: Count of trips operating at or above 80% capacity.
- **Telemetry Data Quality**: Transparent accounting of sensor and ticketing data confidence:
  - `HIGH_DATA_QUALITY`
  - `MEDIUM_DATA_QUALITY`
  - `LOW_DATA_QUALITY`
  - `INSUFFICIENT_DATA`: Explicitly acknowledged without fabrication when telemetry is sparse.

---

## 9. Recommendation Analytics
Governance and workflow tracking for operational recommendations:
- **Lifecycle Counts**: Distribution of actions across `PENDING`, `APPROVED`, `DISMISSED`, and `COMPLETED`.
- **Governance Gaps**:
  - `stalePendingRecommendations`: Pending actions older than 24 hours without administrative review.
  - `overdueApprovedRecommendations`: Approved actions uncompleted after 24 hours.
- **Decision Latency**: Average minutes from generation to approval, and from approval to completion.

---

## 10. Governance Analytics
Synthesized compliance metrics across the transit network:
- **Total Exceptions**: Count of deterministic governance rule violations.
- **Exception Severity Breakdown**: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, and `INFO`.
- **Network Compliance Distribution**: Corridors categorized into:
  - `COMPLIANT`: Zero active critical or high exceptions.
  - `MONITOR`: Low or medium exceptions under observation.
  - `AT_RISK`: High or unaddressed review exceptions.
  - `CRITICAL`: Active safety violations or human-in-the-loop bypasses.
- **Audit Integrity Verification**: Real-time confirmation of SHA-256 cryptographic chain continuity.

---

## 11. Audit Analytics
Audit log telemetry analysis:
- **Total Audit Events**: Persisted log count across the system.
- **Categorization**: Events partitioned by `eventType`, `sourceModule`, `routeId`, and `actor`.
- **Cryptographic Validation**: Direct tally of verified hashes vs. any integrity anomalies.
- **Chain Break Tracking**: Explicit verification of hash-link continuity ($H_i = SHA256(Record_i || H_{i-1})$).

---

## 12. Recurring Pattern Detection
Deterministic, evidence-backed detection of systemic patterns across routes:
- **Activation Threshold**: Patterns require $\ge 2$ discrete occurrences of the same underlying event within the time window.
- **Pattern Classifications**:
  - `REPEATED_HIGH_RISK`
  - `REPEATED_ALERT`
  - `REPEATED_INCIDENT`
  - `REPEATED_DEMAND_PRESSURE`
  - `REPEATED_GOVERNANCE_EXCEPTION`
- **Explainability**: Every detected pattern includes concrete citations of event IDs, route codes, and timestamps.

---

## 13. Executive Insights
Synthesized, factual operational takeaways for senior administrators:
- **No Subjective Language**: Statements omit promotional or qualitative terms such as "best", "worst", "excellent", or "poor".
- **Evidence Backing**: Every insight references explicit numerical metrics, corridor identifiers, and exact counts.
- **Actionable Scoping**: Clear severity categorization (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`) mapping directly to SOC focus areas.

---

## 14. Corridor Analytics
Per-route comprehensive health profiles (`CorridorHealthProfile`):
- Complete profile bundling risk scores, active alerts, incident history, demand telemetry, recommendation status, and governance compliance.
- Assigned unified health status: `HEALTHY`, `NEEDS_ATTENTION`, `AT_RISK`, or `INSUFFICIENT_DATA`.
- Slide-out drawer in the admin UI displaying real-time drill-down metrics and supporting evidence items.

---

## 15. API Contract
### Endpoint: `GET /api/operations/analytics`

#### Query Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `window` | `string` | No | Time window: `LAST_24_HOURS`, `LAST_7_DAYS` (default), `LAST_30_DAYS`, `LAST_90_DAYS`, `CUSTOM` |
| `from` | `string` | No | ISO timestamp start for `CUSTOM` window |
| `to` | `string` | No | ISO timestamp end for `CUSTOM` window |
| `routeId` | `string` | No | Route ID filter (returns 404 if invalid) |
| `report` | `boolean` | No | When `true`, includes complete `report` payload |
| `audit` | `boolean` | No | When `true`, records an immutable audit event |

#### Response Codes:
- `200 OK`: Analytics computed successfully.
- `400 Bad Request`: Invalid date range or custom window parameters.
- `401 Unauthorized`: Unauthenticated request.
- `403 Forbidden`: Non-ADMIN authenticated user.
- `404 Not Found`: Requested route filter does not exist.
- `405 Method Not Allowed`: Returned for `POST`, `PUT`, `PATCH`, `DELETE`.
- `500 Internal Server Error`: Server processing failure.

---

## 16. RBAC & Access Control
- **Strict ADMIN Only**: Validated via `getSessionFromRequest(req)` inspecting the HMAC-SHA256 signed `smartride_token` cookie.
- **COMMUTER & DRIVER Protection**: Any request with `session.role !== 'ADMIN'` is immediately rejected with HTTP 403 Forbidden.
- **Guest Protection**: Unauthenticated requests are rejected with HTTP 401 Unauthorized.

---

## 17. Anti-Forgery & Server Authority
- **Metric Tampering Protection**: Client query parameters or request bodies attempting to supply metrics (e.g., `averageFleetRisk=0`, `peakOccupancy=0`, `totalAuditEvents=99999`) are discarded.
- **Zero Client Overrides**: All counts, rates, scores, and health statuses are calculated directly from persistent server-side records.

---

## 18. UI Architecture
The `OperationalAnalyticsCenter` (`src/components/admin/operational-analytics-center.tsx`) component is integrated into the Platform SOC (`src/app/admin/security/page.tsx`):
1. **Advisory Safety Banner**: Clearly declares that the center is strictly analytical and advisory.
2. **Time Window Selector**: Interactive pill buttons for predefined windows and custom date pickers.
3. **8 Executive KPI Cards**: Grid summarizing analyzed routes, risk averages, alerts, incidents, capacity, recommendations, and compliance.
4. **Visual Analytics Charts**: Responsive SVG charts powered by `recharts` showing corridor risk trends and operational event breakdowns.
5. **Corridor Health Comparison Matrix**: Multi-column table with deterministic sorting by Route, Health Status, Risk Score, Alerts, Incidents, and Recommendations.
6. **Corridor Health Drawer**: Slide-out panel presenting detailed corridor telemetry, assigned drivers, and concrete evidence entries.
7. **Executive Report Modal**: Formatted executive report with print-optimized CSS for PDF export (`window.print()`).

---

## 19. Executive Report Generation
When requested via `?report=true` or via the UI "Generate Report" button:
- Generates `ExecutiveReportData` containing full metadata, author identity, timestamp, and active time window bounds.
- Bundles complete summaries across risk, safety, incidents, demand, recommendations, governance, and audit.
- Embeds mandatory Human-in-the-Loop notices and analytical limitations disclaimers.

---

## 20. Report Integrity & Audit Logging
- Standard analytics browsing does not pollute audit logs.
- When an administrator explicitly generates a formal report or views analytics with `?audit=true`, an immutable event (`EXECUTIVE_REPORT_GENERATED` or `OPERATIONAL_ANALYTICS_VIEWED`) is appended to the SHA-256 tamper-evident audit store.

---

## 21. Testing Suite
Dedicated automated test suite: `scratch/verify_step20.mjs`

### Test Coverage (49 Total Tests):
- **RBAC & Authorization (Tests 1–4)**: Admin 200, Guest 401, Commuter 403, Driver 403.
- **Route Filtering (Tests 5–6)**: Route-specific query 200, unknown route 404.
- **Time Windows (Tests 7–11)**: `LAST_24_HOURS`, `LAST_7_DAYS`, `LAST_30_DAYS`, `LAST_90_DAYS`, invalid date range rejection (400).
- **Mutation Guards (Tests 12–15)**: `POST`, `PUT`, `PATCH`, `DELETE` return 405 Method Not Allowed.
- **Response Structure (Tests 16–23)**: Executive summary, risk, alerts, incidents, demand, recommendations, governance, audit.
- **Server Authority & Derivation (Tests 24–28)**: Bounded calculations, severity sum consistency, open/closed lifecycle balance.
- **Anti-Forgery (Tests 29–32)**: Rejection of client-forged risk, demand, governance, and audit values.
- **Data Integrity & Honesty (Tests 33–36)**: Honest `INSUFFICIENT_DATA` representation, pattern thresholds $\ge 2$, factual evidence citations, corridor profiles.
- **Report Generation (Tests 37–38)**: Time window preservation, server-authoritative values.
- **Step 1–9 Regression Guards (Tests 39–47)**: Verified continued functionality of Route Risk (Step 1), Risk History (Step 2), Safety Alerts (Step 3), Incidents (Step 4), Demand Prediction (Step 5), Decision Support (Step 6), Recommendations (Step 7), Audit (Step 8), Governance (Step 9).
- **UI & Audit Integration (Tests 48–49)**: Security Center page load (200), explicit audit event generation.

**Result: 49/49 PASSED (100%)**

---

## 22. Regression Testing
All historical regression suites were executed sequentially and verified against the running server:
- `scratch/verify_step20.mjs`: **49/49 PASSED (100%)**
- `scratch/verify_step19.mjs`: **43/43 PASSED (100%)**
- `scratch/verify_step18.mjs`: **50/50 PASSED (100%)**
- `scratch/verify_step17.mjs`: **44/44 PASSED (100%)**
- `scratch/verify_step16.mjs`: **30/30 PASSED (100%)**
- `scratch/verify_step15.mjs`: **35/35 PASSED (100%)**
- `scratch/verify_step14.mjs`: **40/40 PASSED (100%)**
- `scratch/verify_step13.mjs`: **30/30 PASSED (100%)**
- `scratch/verify_step12.mjs`: **21/21 PASSED (100%)**

**Cumulative Regression Score: 342/342 PASSED (100%)**

---

## 23. Performance & Resource Characteristics
- **In-Memory Analytical Indexing**: Pre-aggregates snapshots and audit events into memory maps during window evaluation to ensure sub-100ms response times for standard fleet queries.
- **Optimized SQL Queries**: Route queries leverage indexed foreign keys in SQLite.
- **Bundle Footprint**: Recharts visual components leverage standard tree-shaken imports, maintaining optimal First Load JS bundle size.

---

## 24. Limitations
- **Corridor Granularity**: Analytics evaluate at the route and network level; individual waypoint-level sensor breakdowns are summarized rather than streamed in high frequency.
- **Telemetry Dependency**: Routes with sparse historical bookings honestly report `INSUFFICIENT_DATA` until sufficient operational volume is accumulated.

---

## 25. Future Extensions
- **Multi-Tenant Corridor Comparison**: Cross-network corridor benchmarking for multi-city transit deployments.
- **Automated Report Distribution**: Scheduled email/webhook delivery of signed executive summaries directly to senior transit leadership.
