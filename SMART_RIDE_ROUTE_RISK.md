# Smart Commute Intelligence — Route Risk Score Specification

## 1. Purpose
The Route Risk Score is the foundational capability of the Phase 3 Smart Commute Intelligence & Safety module. It provides a deterministic, transparent, and explainable operational risk index for any SmartRide transit corridor route. It enables central dispatchers and operations admins to proactively evaluate corridor health and driver/vehicle compliance.

---

## 2. Data Sources Used
The score is strictly computed from existing, verified platform data without artificial or synthetic random numbers:
1. **Operational Safety Events (`prisma.safetyEvent`)**:
   - `ROUTE_DEVIATION`: Off-corridor diversions.
   - `SPEED_ANOMALY`: Corridor speed limit violations.
   - `LONG_STOP`: Unauthorized stationary vehicle delays away from designated hubs.
   - `GPS_SIGNAL_LOSS`: Telemetry signal drops.
   - `SOS_INCIDENT`: Triggered passenger panic alerts.
2. **Event Lifecycle & Status**:
   - `ACTIVE` / `INVESTIGATING` / `ACKNOWLEDGED`: Open security incidents with immediate risk weight.
   - `RESOLVED` / `DISMISSED`: Historical incidents with reduced residual risk weight.
3. **Driver KYC & Operational Verification (`FirestoreDriverProfile`)**:
   - Primary assigned driver presence and `driverProfile.isVerified` approval status.
4. **Vehicle Inspection & Compliance (`FirestoreVehicle`)**:
   - Primary assigned vehicle presence, `vehicle.isApproved` inspection status, and RC/insurance documents.
5. **Corridor Transit Geometry (`FirestoreRoute`)**:
   - Route distance (km) and waypoint stop density.

---

## 3. Risk Formula & Scoring Weights

The score is computed on a scale of **0 to 100**, where **Higher score = Higher risk**:

$$\text{Route Risk Score} = \min\left(100, \max\left(0, \sum \text{Factor Contributions}\right)\right)$$

### Factor Weights:

| Risk Dimension | Trigger Condition | Points per Incident | Max Dimension Points |
| :--- | :--- | :---: | :---: |
| **Emergency / SOS Alerts** | Active unresolved SOS incident or live trip SOS alert | +35 pts | 50 pts |
| **Route Deviations** | Active off-corridor diversion (`ACTIVE`/`INVESTIGATING`)<br>Resolved deviation (past 7 days) | +15 pts<br>+2 pts | 35 pts |
| **Speed Anomalies** | Active speed surge violation<br>Resolved speed anomaly (past 7 days) | +10 pts<br>+2 pts | 24 pts |
| **Stationary Stops & GPS Drops** | Active unauthorized long stop or telemetry signal loss | +8 pts | 16 pts |
| **Driver KYC Compliance** | Corridor driver missing or `isVerified !== true` | +15 pts | 15 pts |
| **Vehicle Inspection Compliance** | Corridor vehicle missing or `isApproved !== true` | +10 pts | 10 pts |
| **Corridor Transit Complexity** | Route distance > 25 km and waypoints ≥ 5 | +5 pts | 5 pts |

---

## 4. Risk Thresholds & Levels

| Range | Risk Level | Badge Color | Operational Status & Recommended Action |
| :---: | :---: | :---: | :--- |
| **0 – 24** | **`LOW`** | Emerald | Optimal operations. Corridor route compliant with verified driver/vehicle and 0 active anomalies. |
| **25 – 49** | **`MEDIUM`** | Amber | Moderate operational risk. Minor delays, unresolved document audits, or isolated speed surge. |
| **50 – 74** | **`HIGH`** | Orange | Elevated risk. Multiple off-corridor deviations, unapproved driver/vehicle, or persistent telemetry loss. |
| **75 – 100** | **`CRITICAL`** | Rose | Critical security risk. Active SOS alert, unverified dispatch, or clustered safety violations. Dispatcher intervention required. |

---

## 5. API Endpoints

### 1. Single Route Assessment
`GET /api/safety/route-risk?routeId=<routeId_or_code>`

#### Example Response:
```json
{
  "success": true,
  "route": {
    "id": "route-sr-101",
    "code": "SR-101",
    "name": "Whitefield Tech Corridor Express",
    "origin": "Electronic City Phase 1",
    "destination": "ITPB Tech Park Hub",
    "distanceKm": 18.5,
    "estimatedMinutes": 45,
    "assignedDriver": {
      "id": "driver_uid_driver_rajesh_smartride_com",
      "name": "Rajesh Sharma",
      "isVerified": true
    },
    "assignedVehicle": {
      "id": "veh_uid_driver_rajesh_smartride_com",
      "model": "Innova Crysta AC",
      "licensePlate": "KA-01-MJ-8822",
      "isApproved": true
    }
  },
  "risk": {
    "score": 0,
    "level": "LOW",
    "badgeColor": "emerald",
    "summary": "Optimal corridor operations. Route compliant with zero active security anomalies."
  },
  "factors": [
    {
      "name": "Standard Operational Baseline",
      "description": "Corridor operating within normal parameters with verified driver and vehicle compliance.",
      "value": "NORMAL",
      "contribution": 0,
      "severity": "LOW"
    }
  ],
  "metrics": {
    "totalIncidents": 0,
    "activeIncidents": 0,
    "routeDeviations": 0,
    "speedAnomalies": 0,
    "stationaryLongStops": 0,
    "gpsSignalLosses": 0,
    "sosAlerts": 0,
    "driverComplianceScore": 100,
    "vehicleComplianceScore": 100
  },
  "calculatedAt": "2026-09-30T11:00:00.000Z"
}
```

### 2. All Routes Fleet Risk Assessment
`GET /api/safety/route-risk`

Returns an aggregated list of all active corridor routes sorted by risk score descending.

---

## 6. Authorization & Security
- **RBAC**: Strictly restricted to authenticated `ADMIN` sessions via `getSessionFromRequest(req)`.
- **Enforcement**:
  - Unauthenticated requests: HTTP `401 Unauthorized`
  - `COMMUTER` requests: HTTP `403 Forbidden`
  - `DRIVER` requests: HTTP `403 Forbidden`
  - `ADMIN` requests: HTTP `200 OK`
- **Data Privacy**: No commuter personal details (names, emails, phones, payment info) are exposed in factor breakdowns or API payloads.

---

## 7. Limitations & Technical Debt
1. **Deterministic, Not Predictive**: The current score evaluates observed operational anomalies and compliance states. Predictive delay detection based on real-time traffic congestion will be added in subsequent steps.
2. **Telemetry Ingestion Frequency**: Telemetry anomaly records depend on active trip transmissions. When a route is idle outside commute shift hours, the score reflects compliance baseline and historical recency.

---

## 8. Testing & Verification
The engine and API are verified via automated test suite `scratch/verify_step11.mjs`:
- RBAC protection (401 unauth, 403 commuter/driver, 200 admin)
- Mathematical bounds (always 0 ≤ score ≤ 100)
- Correct threshold categorization (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- Factor contribution sum integrity
- 404 handling on nonexistent routes
- Non-regression across all Step 5–10 workflows.
