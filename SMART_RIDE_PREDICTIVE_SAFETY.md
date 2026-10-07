# Smart Commute Intelligence & Safety — Predictive Safety Intelligence

> **Mandatory Disclaimer:** This predictive safety module is a statistical trajectory estimator based on observed historical route-risk data. It does not predict specific future safety incidents. It is not an incident prediction engine and does not guarantee that an accident or emergency will or will not occur.

---

## 1. Purpose
Phase 3 Step 4 introduces the **Predictive Safety Intelligence Engine** to the SmartRide platform. By analyzing verified historical `RouteRiskSnapshot` evaluations, the engine computes explainable statistical risk trajectories and projects expected corridor risk scores for the next operational evaluation interval.

The engine answers the strategic planning question:
> *"Based on the route's observed historical risk snapshots, is the risk trajectory currently trending upward, downward, or remaining stable? If the trajectory continues, what is the mathematically projected risk score?"*

---

## 2. Architecture

```
Observed Corridor Events (Telemetry, Anomalies, SOS, Driver Compliance)
                                ↓
        Deterministic Route Risk Scoring Engine (Step 1)
                                ↓
             Immutable RouteRiskSnapshot Records (Step 2)
                                ↓
           Minimum History Gate (N ≥ 3 Snapshots)
                                ↓
     Ordinary Least Squares (OLS) Linear Regression Engine
                                ↓
      Trajectory Trend (Slope ≥ +2.0 RISING, ≤ -2.0 FALLING, else STABLE)
                                ↓
   Short-Horizon Projection (x = n, Clamped [0, 100], Step 1 Risk Levels)
                                ↓
     Factor Trajectory Analysis & Dominant Driver Identification
                                ↓
        Admin-Only REST Endpoints: GET/POST /api/safety/prediction
                                ↓
            SOC Command Center UI: PredictiveSafetyPanel
```

- **Pure On-Demand Computation**: Projections are derived on-demand from server-verified SQLite `RouteRiskSnapshot` records via `getRouteRiskHistory(routeId)`. This prevents stale caching, eliminates duplicate database tables, and immediately reflects new snapshot evaluations.
- **Zero Black-Box AI / Synthetic Data**: Strictly no LLMs, probabilistic guessing, or artificial incident fabrication.
- **Separation of Operational Alerts and Predictions**: Projections do **not** automatically trigger Step 3 operational safety alerts. Step 3 alerts are triggered exclusively by verified operational observations, preserving alert integrity and preventing false alarms.

---

## 3. Data Sources
The engine consumes existing verified operational snapshots from `prisma.routeRiskSnapshot`:
1. `riskScore`: Server-calculated corridor risk index (0–100).
2. `emergencyPoints`: SOS alerts and critical passenger incidents.
3. `deviationPoints`: Route diversion penalties.
4. `speedPoints`: Speed surges and corridor speeding penalties.
5. `stopGpsPoints`: Prolonged stationary stops and telemetry interruptions.
6. `compliancePoints`: Driver KYC verification and vehicle inspection compliance.
7. `complexityPoints`: Route distance and stop density geometry.
8. `evaluatedAt`: ISO-8601 evaluation timestamp.

---

## 4. Mathematical Model

### Observation Window
For $n$ chronological snapshots evaluated at intervals $x_i = i$ (where $i = 0, 1, \dots, n-1$) with observed risk scores $y_i$:

- Sample Mean of $x$:
  $$\bar{x} = \frac{n - 1}{2}$$
- Sample Mean of $y$:
  $$\bar{y} = \frac{1}{n} \sum_{i=0}^{n-1} y_i$$

---

## 5. Regression Calculation

### Slope ($m$) & Intercept ($b$)
Calculated via Ordinary Least Squares (OLS):
$$m = \frac{\sum_{i=0}^{n-1} (x_i - \bar{x})(y_i - \bar{y})}{\sum_{i=0}^{n-1} (x_i - \bar{x})^2} = \frac{n \sum (x_i y_i) - \sum x_i \sum y_i}{n \sum x_i^2 - (\sum x_i)^2}$$
$$b = \bar{y} - m \bar{x}$$

### Goodness of Fit ($R^2$) and Variance
$$SS_{\text{tot}} = \sum_{i=0}^{n-1} (y_i - \bar{y})^2, \quad SS_{\text{res}} = \sum_{i=0}^{n-1} (y_i - (m x_i + b))^2$$
$$R^2 = 1 - \frac{SS_{\text{res}}}{SS_{\text{tot}}} \quad (\text{if } SS_{\text{tot}} > 0.0001, \text{ else } 1.0)$$

---

## 6. Trend Classification
Trend direction is classified deterministically based on slope ($m$):
- **`RISING`**: $m \ge +2.0$ pts/evaluation (statistically observable upward risk drift).
- **`FALLING`**: $m \le -2.0$ pts/evaluation (statistically observable safety improvement).
- **`STABLE`**: $-2.0 < m < +2.0$ pts/evaluation (corridor risk within baseline stability band).
- **`INSUFFICIENT_HISTORY`**: Fewer than 3 chronological snapshots ($n < 3$).

---

## 7. Projection Methodology

### Projected Risk Score (Next Evaluation)
For the next chronological interval $x = n$:
$$\hat{y}_{\text{raw}} = m \cdot n + b$$

### Bounded Clamping Rule
Scores are strictly clamped to the valid $[0, 100]$ range:
$$\text{projectedScore} = \min\left(100, \max\left(0, \text{round}(\hat{y}_{\text{raw}})\right)\right)$$

### Projected Risk Level (Step 1 Thresholds Preserved)
- **`0 – 24`**: `LOW`
- **`25 – 49`**: `MEDIUM`
- **`50 – 74`**: `HIGH`
- **`75 – 100`**: `CRITICAL`

---

## 8. Confidence Methodology
Confidence is reported deterministically as `HIGH`, `MEDIUM`, or `LOW`:
- **`HIGH`**:
  - Zero historical variance ($\sigma^2 = 0$, perfectly consistent flat baseline), OR
  - Strong linear fit ($R^2 \ge 0.70$) with extensive history ($n \ge 5$).
- **`MEDIUM`**:
  - Moderate linear fit ($R^2 \ge 0.40$ with $n \ge 4$), OR
  - Clean fit ($R^2 \ge 0.85$) at the boundary sample size ($n = 3$).
- **`LOW`**:
  - Noisy data ($R^2 < 0.35$), or minimum history ($n = 3$) with non-trivial variance.

---

## 9. Factor Trend Analysis
Each of the 6 core safety dimensions is tracked individually across the historical snapshot window:
1. `emergencyPoints`: Passenger SOS alerts and critical events.
2. `deviationPoints`: Vehicle off-corridor diversion events.
3. `speedPoints`: Corridor speed surge violations.
4. `stopGpsPoints`: Stationary stops away from stations and telemetry dropouts.
5. `compliancePoints`: Driver KYC verification and vehicle inspection status.
6. `complexityPoints`: Route distance and stop density.

For each factor, an OLS slope $m_f$ is computed across history:
- $m_f \ge 0.5$ $\to$ `RISING`
- $m_f \le -0.5$ $\to$ `FALLING`
- Otherwise $\to$ `STABLE`

---

## 10. Dominant Risk Driver
The dominant risk driver identifies which safety dimension contributes most strongly to an observed upward trajectory:
- Factors with positive slope ($m_f > 0$) are ranked.
- The factor with the highest positive slope is designated as the dominant driver (e.g. `"Speed Anomalies"`, `"Route Deviations"`, `"Emergency Incidents"`).
- If no factor has a positive slope ($m_f \le 0$ for all factors), the engine outputs `"NO_DOMINANT_DRIVER"`.

---

## 11. API Contracts

### `GET /api/safety/prediction?routeId=<id>`
- **Access**: `ADMIN` only (401 unauthenticated, 403 commuter/driver).
- **Parameters**: `routeId` (string, optional; defaults to first active corridor route).
- **Sufficient History Response (200 OK)**:
```json
{
  "success": true,
  "prediction": {
    "routeId": "route-sr-101",
    "routeCode": "SR-101",
    "routeName": "Electronic City Express",
    "predictionStatus": "STABLE",
    "currentScore": 20,
    "currentRiskLevel": "LOW",
    "historicalSnapshotCount": 4,
    "trendDirection": "STABLE",
    "slope": 0,
    "intercept": 20,
    "rSquared": 1,
    "projectionConfidence": "HIGH",
    "projectedScore": 20,
    "projectedRiskLevel": "LOW",
    "dominantRiskDriver": "NO_DOMINANT_DRIVER",
    "factorTrends": {
      "emergency": "STABLE",
      "deviation": "STABLE",
      "speed": "STABLE",
      "stopGps": "STABLE",
      "compliance": "STABLE",
      "complexity": "STABLE"
    },
    "historicalScores": [
      { "evaluatedAt": "2026-10-01T06:50:00.000Z", "riskScore": 20 },
      { "evaluatedAt": "2026-10-01T06:55:00.000Z", "riskScore": 20 },
      { "evaluatedAt": "2026-10-01T07:00:00.000Z", "riskScore": 20 }
    ],
    "evaluatedAt": "2026-10-01T07:05:00.000Z",
    "explanation": "Observed route-risk scores have remained relatively stable across the latest 4 snapshots (slope: 0 pts/eval). Based on historical least-squares regression (R²: 1), projected score for next observation is 20/100 (LOW).",
    "disclaimer": "This projection is based on observed historical route-risk scores. It is a statistical trajectory estimate, not a prediction of a specific safety incident."
  }
}
```

### Insufficient History Response (200 OK)
When fewer than 3 historical snapshots exist:
```json
{
  "success": true,
  "prediction": {
    "predictionStatus": "INSUFFICIENT_HISTORY",
    "historicalSnapshotCount": 1,
    "message": "At least 3 historical route-risk snapshots are required to estimate a risk trajectory."
  }
}
```

---

## 12. RBAC Behavior
- **`ADMIN`**: Full access to predictive safety endpoints (`200 OK`).
- **`DRIVER`**: Blocked with `403 Forbidden`.
- **`COMMUTER`**: Blocked with `403 Forbidden`.
- **Unauthenticated**: Blocked with `401 Unauthorized`.

---

## 13. Anti-Forgery Protections
- All statistical metrics (`currentScore`, `slope`, `intercept`, `rSquared`, `projectionConfidence`, `projectedScore`, `projectedRiskLevel`, `dominantRiskDriver`, `factorTrends`) are computed exclusively server-side.
- Any client-submitted tamper payloads in `POST` requests are completely ignored; the server pulls verified database snapshots only.

---

## 14. Admin UI (`PredictiveSafetyPanel`)
Located at `src/components/admin/predictive-safety-panel.tsx` and mounted in `/admin/security`:
1. **Corridor Selector**: Allows switching between active routes.
2. **"Analyze Risk Trajectory" Button**: On-demand re-evaluation of the selected corridor.
3. **KPI Cards**:
   - Current Observed Risk
   - Trajectory Direction
   - Projected Risk Score (Next)
   - Projection Confidence
4. **Interactive Regression Chart (Recharts)**:
   - Observed historical risk rendered with solid cyan markers and line.
   - OLS trend line rendered as a dashed slate line.
   - Projected next evaluation rendered as an indigo dot.
   - Strict visual distinction ensuring users clearly know observed history vs projected estimate.
5. **Factor Breakdown**: 6 cards detailing dimension slopes and trajectory states.
6. **Dominant Trajectory Driver**: Badge highlighting the primary source of upward risk.
7. **Statistical Disclaimer Banner**: Permanent footer reminding operators of model bounds.

---

## 15. Limitations & Technical Debt
1. **Historical Data Quality**: Projections are entirely contingent on recorded snapshots. Corridors with sparse observations will have low confidence or return `INSUFFICIENT_HISTORY`.
2. **Linear Assumption**: Linear regression captures monotonic drift well, but sudden step-function changes (e.g. unexpected roadblock) will only be reflected after multiple snapshots capture the new state.
3. **Short Horizon**: Projections are intended strictly for $x = n$ (the next evaluation period) and must not be extrapolated far into the future.
4. **No Direct Weather/Traffic APIs**: External conditions are captured only to the extent that they induce observed speed anomalies, GPS delays, or route deviations.
5. **No Accident Prediction**: The system cannot and does not predict the certainty, location, or timing of collisions or crimes.

---

## 16. Future Extensions (Non-Breaking)
- Multi-horizon forecasts ($t+1, t+2, t+3$) with widening confidence bands.
- Exponentially weighted moving average (EWMA) trend blending for rapidly changing corridors.
- Scheduled snapshot generation at fixed dispatch intervals.

---

## 17. Verification & Test Summary
The complete Step 14 test suite (`scratch/verify_step14.mjs`) verified all 30 criteria:
- **30/30 Step 14 tests PASSED** (100%).
- **30/30 Step 13 tests PASSED** (100%).
- **21/21 Step 12 tests PASSED** (100%).
- **Production Build (`npm run build`) PASSED** with 0 errors.
