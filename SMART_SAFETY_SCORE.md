# 🛡️ SmartRide (CommuteSync) — Smart Trip Safety Score Documentation

> **Official Disclaimer**:
> *"The Smart Trip Safety Score is an operational risk indicator derived from configured rules and available trip telemetry. It is not a guarantee that a trip is objectively safe."*

---

## 1. Executive Summary & Concept

The **Smart Trip Safety Score** is a real-time, transparent operational risk assessment engine built for **SmartRide (CommuteSync)**. Designed for enterprise tech shuttle corridors (such as Bangalore's Outer Ring Road and Whitefield IT corridors), it computes a continuous safety metric between **0 and 100** for every active commute shift.

Instead of treating safety as a binary flag or an opaque heuristic, SmartRide evaluates safety across **six operational dimensions**:
1. **Driver Verification & KYC Compliance** (20 pts)
2. **Vehicle Roadworthiness & Document Approvals** (15 pts)
3. **Passenger Boarding & OTP Security** (15 pts)
4. **Route Corridor Adherence & Deviation Monitoring** (20 pts)
5. **Vehicle Velocity & Speed Compliance** (15 pts)
6. **Emergency Events & Telemetry Health** (15 pts)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SMART TRIP SAFETY SCORE                         │
│                                                                        │
│                                94 / 100                                │
│                              🟢 LOW RISK                               │
│                                                                        │
│   Driver Verification (KYC)      20 / 20  ✓  Captain verified         │
│   Vehicle Documents              15 / 15  ✓  RC & Insurance active    │
│   OTP Boarding Verification      15 / 15  ✓  All passengers verified  │
│   Route Corridor Adherence       20 / 20  ✓  Within 42m of corridor   │
│   Speed Monitoring               15 / 15  ✓  42 km/h (Normal flow)    │
│   Emergency SOS / Telemetry      15 / 15  ✓  Zero active emergencies  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mathematical Scoring Model

The scoring engine operates on a **subtractive deduction model** starting from a pristine baseline score of **100 points**:

$$\text{Safety Score } S = \max\left(0, \min\left(100, 100 - \sum_{i=1}^{6} D_i\right)\right)$$

Where $D_i$ represents the penalty deduction evaluated for each dimension.

### Weight Distribution & Deduction Rules

| Dimension ($i$) | Max Weight | Nominal Score | Mathematical Deduction Formula ($D_i$) |
| :--- | :---: | :---: | :--- |
| **1. Driver Verification** | 20 pts | 20 / 20 | $D_1 = \begin{cases} 0 & \text{if driver is KYC-verified} \\ 20 & \text{if unverified or pending} \end{cases}$ |
| **2. Vehicle Documents** | 15 pts | 15 / 15 | $D_2 = \begin{cases} 0 & \text{if RC and Insurance approved} \\ 15 & \text{if documents missing or expired} \end{cases}$ |
| **3. OTP Boarding** | 15 pts | 15 / 15 | $D_3 = \min\left(15, \text{round}\left(15 \times \frac{U}{N}\right) + 3 \times F\right)$<br>Where $U$ = unboarded passengers, $N$ = total passengers, $F$ = failed OTP attempts |
| **4. Route Corridor Compliance** | 20 pts | 20 / 20 | $D_4 = \begin{cases} 0 & \text{if distance } d \le 100\text{m} \\ 5 & \text{if } 100\text{m} < d \le 300\text{m} \text{ (Minor)} \\ 10 & \text{if } 300\text{m} < d \le 500\text{m} \text{ (Warning)} \\ 20 & \text{if } d > 500\text{m} \text{ (Major)} \end{cases}$ |
| **5. Speed Monitoring** | 15 pts | 15 / 15 | $D_5 = \begin{cases} 0 & \text{if } v \le 55\text{ km/h} \\ 5 & \text{if } 55 < v \le 70\text{ km/h} \text{ (Moderate)} \\ 10 & \text{if } 70 < v \le 85\text{ km/h} \text{ (High)} \\ 15 & \text{if } v > 85\text{ km/h} \text{ (Severe)} \end{cases}$ |
| **6. Emergency & Telemetry Health** | 15 pts | 15 / 15 | $D_6 = \min\left(15, D_{\text{sos}} + D_{\text{gps}} + D_{\text{stop}}\right)$<br>• $D_{\text{sos}} = 15$ if active SOS<br>• $D_{\text{gps}} = 8$ if telemetry ping stale $> 120\text{s}$<br>• $D_{\text{stop}} = 6$ if stationary $> 300\text{s}$ outside stops |

---

## 3. Operational Risk Classification

Scores are classified into four standardized risk bands:

```
Score Range      Classification         Badge Color       Operational Guidance
─────────────────────────────────────────────────────────────────────────────────────────────
90 – 100    →   🟢 LOW RISK            emerald           Nominal commute; standard monitoring
75 – 89     →   🟡 MODERATE RISK       amber             Minor variance; driver advisory
50 – 74     →   🟠 HIGH RISK           orange            Corridor deviation/speeding; admin review
0 – 49      →   🔴 CRITICAL RISK       rose              Active SOS / critical hazard; immediate intervention
```

---

## 4. Anomaly Detection Algorithms & Configurable Thresholds

All anomaly detection parameters are managed centrally in `src/lib/safety/anomaly-detection.ts` rather than scattered as magic numbers:

```typescript
export const SAFETY_CONFIG = {
  CORRIDOR_DEVIATION_TOLERANCE_METERS: 100, // Safe operating buffer
  CORRIDOR_DEVIATION_MINOR_METERS: 300,     // Minor traffic diversion
  CORRIDOR_DEVIATION_WARNING_METERS: 500,   // Warning deviation
  CORRIDOR_EXPECTED_SPEED_KMH: 45,          // Corridor design velocity
  CORRIDOR_SPEEDING_THRESHOLD_KMH: 55,      // +10 km/h over design
  CORRIDOR_HIGH_SPEEDING_KMH: 70,           // +25 km/h over design
  CORRIDOR_MAX_OPERATIONAL_SPEED_KMH: 85,   // Maximum safe cap
  GPS_SIGNAL_TIMEOUT_SECONDS: 120,          // 2 minutes telemetry loss
  LONG_STOP_THRESHOLD_SECONDS: 300,         // 5 minutes stationary
  LONG_STOP_SPEED_CUTOFF_KMH: 3,            // Stationary threshold
  DESIGNATED_STOP_PROXIMITY_METERS: 150,    // Stop exemption radius
  EVENT_ALERT_COOLDOWN_SECONDS: 60,         // Alert deduplication window
};
```

### A. Perpendicular Distance to Corridor
To compute the true distance from the shuttle's current location $P(x, y)$ to the assigned route corridor, the system calculates the perpendicular projection of $P$ onto each linear segment $[A, B]$ formed by consecutive corridor waypoints:

$$t = \max\left(0, \min\left(1, \frac{\vec{AP} \cdot \vec{AB}}{\|\vec{AB}\|^2}\right)\right)$$
$$\text{Projection } P' = A + t \cdot \vec{AB}$$
$$d = \|P - P'\|$$

If $d > 500\text{m}$, the system emits a `ROUTE_DEVIATION` event with `HIGH` severity.

### B. Stationary Stop Exemption (Zero False Positives)
Vehicles frequently stop for several minutes at designated corporate pickup bays (e.g. *Agara Lake Junction*, *Bellandur EcoSpace*). Flagging these as anomalies would cause operator fatigue.

The algorithm calculates the Haversine distance from the stationary vehicle to all designated route stops:
$$\text{dist}(P, \text{Stop}_k) \le 150\text{ meters} \implies \text{Exempt (Boarding Bay)}$$
A `LONG_STOP` anomaly is triggered **only** if the vehicle remains stationary ($v \le 3\text{ km/h}$) for more than 5 minutes outside the 150m radius of any designated waypoint.

### C. Dynamic Recovery Rules
- **Corridor Recovery**: When the vehicle returns within 100m of the corridor centerline, deduction $D_4$ drops to 0, and a `ROUTE_RECOVERY` timeline event is logged.
- **Speed Recovery**: When velocity stabilizes below 55 km/h, $D_5$ recovers to 0, logging `SPEED_NORMALIZED`.
- **Signal Restoration**: Receiving a fresh GPS ping clears $D_{\text{gps}}$ and records `GPS_SIGNAL_RESTORED`.
- **SOS Resolution**: When an Admin clicks "Mark Incident Resolved", $D_{\text{sos}}$ clears, restoring 15 points.
- **Anti-Creep Rule**: The score does **not** recover simply because time has passed. The physical or operational anomaly must be genuinely resolved.

---

## 5. Privacy & Data Sanitization Matrix

SmartRide enforces strict Role-Based Access Control (RBAC) to ensure private information is never leaked on public tracking links:

| Data Field | Admin Command Center | Driver Portal | Commuter Dashboard | Public Live Radar (`/track/[token]`) |
| :--- | :---: | :---: | :---: | :---: |
| **Numerical Safety Score** | ✓ (Full 0–100) | ✓ (Full 0–100) | ✓ (Full 0–100) | ✓ (Full 0–100) |
| **Risk Level Badge** | ✓ (`🟢 LOW RISK`) | ✓ (`🟢 LOW RISK`) | ✓ (`🟢 LOW RISK`) | ✓ (`🟢 LOW RISK`) |
| **6-Dimension Breakdown** | ✓ (Full audit) | ✓ (Operational) | ✓ (Commuter view) | ❌ Hidden |
| **Driver Verification Status** | ✓ (KYC details) | ✓ (Own profile) | ✓ (Badge) | ✓ (Sanitized badge only) |
| **Driver Personal Phone** | ✓ (Dispatch call) | ✓ (Self) | ❌ Hidden | ❌ Hidden (Shows 24/7 Desk) |
| **Passenger Names & OTPs** | ✓ (Manifest) | ✓ (Verification) | ✓ (Own OTP only) | ❌ Strictly Redacted |
| **Internal Anomaly Audit Logs** | ✓ (Full control) | ❌ Redacted | ❌ Redacted | ❌ Strictly Redacted |

---

## 6. Database Schema (Prisma SQLite)

```prisma
model TripSafetyScore {
  id                      String   @id @default(cuid())
  tripId                  String
  score                   Int      @default(100)
  riskLevel               String   @default("LOW") // LOW, MODERATE, HIGH, CRITICAL
  driverVerificationScore Int      @default(20)
  vehicleDocumentScore    Int      @default(15)
  otpScore                Int      @default(15)
  routeComplianceScore    Int      @default(20)
  speedScore              Int      @default(15)
  emergencyScore          Int      @default(15)
  primaryReason           String?
  calculatedAt            DateTime @default(now())

  events                  SafetyEvent[]
}

model SafetyEvent {
  id             String           @id @default(cuid())
  tripId         String
  safetyScoreId  String?
  safetyScore    TripSafetyScore? @relation(fields: [safetyScoreId], references: [id], onDelete: SetNull)
  type           String           // ROUTE_DEVIATION, SPEED_ANOMALY, OTP_FAILURE, etc.
  severity       String           // INFO, LOW, MEDIUM, HIGH, CRITICAL
  title          String
  description    String
  metadata       String?          // JSON string of event metadata
  status         String           @default("ACTIVE") // ACTIVE, INVESTIGATED, RESOLVED
  detectedAt     DateTime         @default(now())
  resolvedAt     DateTime?
  resolutionNote String?
}
```

---

## 7. Rule-Based Scoring vs. Machine Learning (Academic Distinction)

> **Important for MCA Viva Examination**:
> SmartRide deliberately implements the initial Smart Trip Safety Score as a **transparent, deterministic, rule-based expert scoring system** rather than claiming it is a machine learning model.

### Why Rule-Based Scoring is Acadeically Superior for Safety Critical Systems:
1. **Explainability & Accountability**: In public transport safety, an admin or passenger must know the exact cause of a score deduction (e.g. `420m route deviation` or `Unverified driver`). Black-box neural networks or unsupervised clustering models cannot provide guaranteed explanations.
2. **Determinism**: A safety score must be reproducible and mathematically bounded. If a driver deviates 600m, the deduction must consistently be 20 points, not subject to stochastic variation.
3. **Absence of Ground-Truth Accident Labels**: In a corporate shuttle service, accidents and critical emergencies are rare events ($<0.01\%$). Training a supervised ML classifier on extreme class imbalance would lead to high false-alarm rates or overfitting.

### Future ML Extension Architecture:
A future extension can introduce an **Unsupervised Isolation Forest or Autoencoder** to compute an *Anomaly Probability Index* ($P_{\text{anomaly}} \in [0, 1]$) based on:
- 3-axis accelerometer telematics ($\Delta v_x, \Delta v_y$, harsh braking, sharp turning)
- Time-of-day traffic speed distributions
- Historical corridor dwell times

---

## 8. MCA Viva Voce Defense Cheat Sheet

### Q1: How is the Smart Safety Score calculated?
**Answer**: It uses a transparent subtractive model starting from a base score of 100. Points are deducted across six weighted dimensions: Driver KYC (20), Vehicle Roadworthiness (15), OTP Manifest Verification (15), Corridor Adherence (20), Speed Monitoring (15), and Emergency/Telemetry Health (15). The final score is clamped between 0 and 100.

### Q2: How do you prevent false alarms when a shuttle stops at a traffic signal or bus stop?
**Answer**: We implement a 150-meter geo-fencing proximity exemption around all designated corridor waypoints. If the vehicle is stationary near a designated stop, the system recognizes it as scheduled passenger boarding rather than an unexpected long stop anomaly.

### Q3: Why is this rule-based instead of machine learning?
**Answer**: Transportation safety audits require 100% determinism, mathematical bounds, and explicit causal explainability. Hard safety requirements like KYC verification, valid insurance, and emergency SOS alerts must directly penalize the score without relying on statistical approximations.

### Q4: How is passenger privacy preserved on public family tracking links?
**Answer**: Through a dedicated public projection layer (`createSanitizedPublicSafetyIndicator`). Public family users at `/track/[shareToken]` receive only high-trust aggregate trust badges and the numerical score. Passenger identities, personal phone numbers, OTP codes, and internal audit logs are strictly filtered out on the backend before serialization.
