# 🧠 AI-Based Smart Route & Demand Prediction (SmartRide AI)
### Comprehensive Academic & Technical Project Documentation (MCA Viva Reference)

---

## 1. Executive Summary & Problem Formulation

In corporate shared-mobility platforms like **SmartRide (CommuteSync)**, route captains operate dedicated fixed-corridor shuttles (such as `SR-101: HSR Layout → ITPB Tech Park`) during morning pickup and evening return windows. Traditional fleet dispatching relies on static schedules, which leads to two severe operational bottlenecks:
1. **Capacity Overflows (Unmet Demand)**: On high-demand days (especially Mondays and post-holiday mornings), passenger demand exceeds vehicle seat limits, causing commuter walkaways and customer frustration.
2. **Under-Utilization & Idle Running (Fuel & Driver Waste)**: On low-demand shifts (such as Friday hybrid work afternoons), full-sized shuttles operate with less than 40% occupancy, incurring avoidable operational overhead.

The **SmartRide AI Demand Prediction System** solves this by establishing a proactive, machine-learning-driven demand intelligence engine that forecasts passenger volume before dispatch, estimates seat occupancy, identifies queue pressures at intermediate pickup stops, and generates actionable, non-mutative advisory recommendations for platform administrators.

---

## 2. Decoupled Pipeline Architecture

A key academic strength of this project is the strict separation between **Statistical Machine Learning** and the **Operational Business Rule Recommendation Engine**:

```
[ 1. Historical SmartRide Data ]
              ↓
[ 2. Data Cleaning & Normalization ]
              ↓
[ 3. Feature Engineering & Lag Generation ]
              ↓
[ 4. Random Forest Regressor Training ]
              ↓
[ 5. Holdout Evaluation (Empirical MAE, RMSE, R²) ]
              ↓
[ 6. Demand Prediction Inference (ŷ passengers) ]
              ↓
[ 7. Occupancy Calculation (ŷ / Capacity × 100) ]
              ↓
[ 8. Business Rule Recommendation Engine ]
              ↓
[ 9. Admin Advisory Presentation (UI & KPIs) ]
              ↓
[ 10. Admin Human-in-the-Loop Decision ]
```

> **Strict Non-Mutative Guarantee**: The AI model computes expected volume, but **NEVER** mutates routes, alters assigned drivers, or reallocates seats without explicit Admin approval.

---

## 3. Dataset & Feature Engineering

### 3.1 Dataset Layer (`src/lib/ai/historical-data.ts`)
When live historical records are bootstrapping, a dedicated **Synthetic Historical Commute Dataset Generator** generates 60+ days of realistic corridor dispatches across tech corridors (`SR-101`, `SR-102`, `SR-103`, `SR-104`). It models authentic commuter transit characteristics:
- **Monday Surge**: +15% above weekly median return-to-office rate.
- **Friday Hybrid Dip**: -24% in-office attendance drop due to work-from-home policies.
- **Shift Punctuality**: Morning pickup demand is tightly clustered; evening return is more dispersed.
- **Attrition**: Realistic cancellation rates (3%–8%) and no-show rates (1%–3%).

### 3.2 Feature Set ($X$) & Target ($y$) (`src/lib/ai/feature-engineering.ts`)

| Feature Index | Feature Name | Data Type | Academic Rationale & Description |
| :--- | :--- | :--- | :--- |
| $x_0$ | `route_code_idx` | Integer | Categorical encoding identifying specific corridor geography. |
| $x_1$ | `shift_idx` | Binary (0 / 1) | 0 = Morning Pickup (08:30 AM), 1 = Evening Return (06:00 PM). |
| $x_2$ | `day_of_week` | Integer (0–6) | Models periodic weekly corporate rhythm (Mon peak vs. Fri dip). |
| $x_3$ | `week_of_month` | Integer (1–5) | Captures corporate month-end accounting & hybrid rotation cycles. |
| $x_4$ | `vehicle_capacity` | Integer | Seat ceiling of vehicle assigned to the corridor (e.g., 8, 12, 16, 20). |
| $x_5$ | `historical_avg_demand` | Continuous | Long-term 30-day baseline passenger volume for that route & shift. |
| $x_6$ | `recent_trend_7d` | Continuous | Rolling 7-day moving average capturing short-term demand momentum. |
| $x_7$ | `prev_same_day_lag` | Continuous | Same day-of-week lag demand from previous week ($t-7$). |
| $x_8$ | `cancellation_rate` | Continuous | Historical ratio of commuter cancellations to scheduled bookings. |

**Target Variable ($y$)**: `actual_demand` (Continuous Integer) — The true number of passengers boarding the shuttle for that specific route and shift.

---

## 4. Machine Learning Model: Random Forest Regressor

### 4.1 Why Random Forest was Selected
1. **Non-Linear Relationships**: Commute demand exhibits non-linear interactions (e.g., a Monday morning surge is far more pronounced than a Wednesday morning surge). Tree-based ensembles naturally capture feature interactions without requiring polynomial terms.
2. **Robustness Against Overfitting**: Individual decision trees have high variance and easily overfit noisy transit data. Random Forest employs **Bootstrap Aggregation (Bagging)** and **Random Feature Subsampling** to decorrelate individual trees and drastically reduce generalization variance.
3. **Scale Invariance**: Unlike Linear Regression or Support Vector Machines, tree models do not require z-score standardization or min-max normalization of disparate features.
4. **Native Feature Importance**: Provides mathematical interpretability by measuring cumulative variance reduction across all trees.

### 4.2 Mathematical Formulation (`src/lib/ai/model.ts`)
For a training dataset $D = \{(x_1, y_1), \dots, (x_n, y_n)\}$:
1. **Bootstrap Aggregating**: Draw $B = 25$ bootstrap datasets $D_b$ of size $n$ by sampling with replacement from $D$.
2. **Feature Subsampling**: At each node of tree $T_b$, randomly select $m = \lceil \sqrt{p} \rceil + 1$ features from the total $p = 9$ features.
3. **Variance Reduction Splitting Criterion**: Split node $S$ into subsets $S_L$ and $S_R$ on feature $j$ at threshold $s$ to maximize Mean Squared Error (MSE) reduction:
   $$\Delta \text{Var}(S, j, s) = \text{Var}(y_S) - \left[ \frac{|S_L|}{|S|} \text{Var}(y_{S_L}) + \frac{|S_R|}{|S|} \text{Var}(y_{S_R}) \right]$$
4. **Ensemble Prediction**: The final continuous prediction $\hat{y}$ is the average prediction across all $B$ decision trees:
   $$\hat{y}(x) = \frac{1}{B} \sum_{b=1}^{B} T_b(x)$$

---

## 5. Model Evaluation Metrics (`src/lib/ai/evaluation.ts`)

The dataset is partitioned using an **80/20 train/test holdout split**. The evaluation metrics are **empirically calculated directly on the unseen 20% test partition**:

1. **Mean Absolute Error (MAE)**:
   $$MAE = \frac{1}{n_{\text{test}}} \sum_{i=1}^{n_{\text{test}}} |y_i - \hat{y}_i|$$
   *Meaning*: Measures the average passenger count discrepancy. An MAE of $1.8$ means predictions deviate by fewer than 2 passengers on average.
2. **Root Mean Squared Error (RMSE)**:
   $$RMSE = \sqrt{\frac{1}{n_{\text{test}}} \sum_{i=1}^{n_{\text{test}}} (y_i - \hat{y}_i)^2}$$
   *Meaning*: Penalizes large outlier forecast errors heavily, revealing worst-case prediction volatility.
3. **Coefficient of Determination ($R^2$)**:
   $$R^2 = 1 - \frac{\sum_{i=1}^{n_{\text{test}}} (y_i - \hat{y}_i)^2}{\sum_{i=1}^{n_{\text{test}}} (y_i - \bar{y})^2}$$
   *Meaning*: Quantifies the proportion of variance in passenger demand explained by the engineered features relative to a naive mean predictor.
4. **Feature Importance**:
   Calculated by summing the variance reduction achieved by each feature across all tree splits and normalizing:
   $$I(f_j) = \frac{\sum_{b=1}^B \sum_{t \in T_b, \text{split}(t)=j} \Delta \text{Var}(t) \cdot |S_t|}{\sum_{k=1}^p I(f_k)}$$

---

## 6. Business-Rule Recommendation Engine (`src/lib/ai/business-rules.ts`)

Once the ML model infers $\hat{y}$ (expected passengers), the **Business-Rule Engine** evaluates operational thresholds:

### 6.1 Occupancy & Status Classification
$$\text{Occupancy} = \frac{\hat{y}}{\text{Vehicle Capacity}} \times 100\%$$

| Occupancy Range | Status Badge | Operational Action |
| :--- | :--- | :--- |
| $< 50\%$ | `LOW` | Candidate for corridor passenger consolidation. |
| $50\% - 80\%$ | `NORMAL` | Standard dispatch; operating within optimal capacity window. |
| $80\% - 95\%$ | `HIGH` | Near capacity; alert driver and monitor standby roster. |
| $> 95\%$ | `CRITICAL` | Imminent overflow; trigger additional shuttle recommendation. |

### 6.2 Additional Shuttle Math
$$\text{Required Vehicles} = \left\lceil \frac{\hat{y}}{\text{Vehicle Capacity}} \right\rceil$$
$$\text{Additional Shuttles Recommended} = \max(0, \text{Required Vehicles} - 1)$$

*Example*: If predicted demand = $38$ passengers for a $20$-passenger shuttle:
$$\text{Required} = \lceil 38 / 20 \rceil = 2 \implies \text{Deploy } 1 \text{ additional shuttle.}$$

### 6.3 Pickup Stop Pressure Analysis
Distributes corridor demand across stops according to topological transit weights (first hub boards ~35%, intermediate stops ~25%, final drop boards remainder). Classifies intermediate stops as `Normal`, `Moderate`, `High`, or `Critical` crowd density.

### 6.4 Route Consolidation (Merge) Recommendations
Identifies pairs of routes with $< 55\%$ occupancy sharing identical tech corridor destinations (e.g. Outer Ring Road / Bellandur), recommending combined vehicle operation to save driver and fuel costs.
*Tag*: **AI/Algorithmic Recommendation — Admin Review Required**.

---

## 7. REST API Reference

### `GET /api/ai/demand-prediction`
* **Access**: Authenticated Admin (`role === 'ADMIN'`) or Guest mode (`?mode=guest`).
* **Response Payload**:
  ```json
  {
    "success": true,
    "summary": {
      "forecastDate": "2026-09-17",
      "totalPredictedDemand": 68,
      "expectedOccupancy": 85.0,
      "highDemandRoutes": 2,
      "additionalShuttlesRecommended": 1
    },
    "weeklyForecast": [
      { "day": "Mon", "historicalDemand": 82, "predictedDemand": 85 },
      { "day": "Tue", "historicalDemand": 74, "predictedDemand": 76 },
      { "day": "Wed", "historicalDemand": 70, "predictedDemand": 71 },
      { "day": "Thu", "historicalDemand": 66, "predictedDemand": 65 },
      { "day": "Fri", "historicalDemand": 52, "predictedDemand": 50 }
    ],
    "routePredictions": [
      {
        "routeId": "route-sr-101",
        "routeCode": "SR-101",
        "routeName": "Whitefield Tech Express (HSR → ITPB)",
        "shift": "MORNING_PICKUP",
        "predictedDemand": 21,
        "vehicleCapacity": 20,
        "predictedOccupancy": 105.0,
        "status": "CRITICAL",
        "recommendation": "Demand exceeds capacity by 1 seat. Deploy 1 additional shuttle.",
        "reliability": "HIGH"
      }
    ],
    "modelMetrics": {
      "mae": 1.82,
      "rmse": 2.38,
      "r2": 0.891,
      "trainSamplesCount": 352,
      "testSamplesCount": 88
    }
  }
  ```

### `POST /api/ai/demand-prediction`
* **Payload**: `{"action": "retrain"}` or `{"action": "generate_demo"}`
* **Behavior**:
  - `action: "retrain"`: Regenerates training batches, trains fresh Random Forest trees, measures real empirical metrics, and saves `AIModelRun` metadata to the database.
  - `action: "generate_demo"`: Generates upcoming shift forecast with simulated real-world transit disturbances.

---

## 8. MCA Viva Voce Defense Cheat-Sheet

| Viva Voce Question | Academic Answer & Defense |
| :--- | :--- |
| **Q1. Why not use simple Linear Regression?** | "Linear regression assumes linear additive relationships. Commute demand exhibits non-linear interactions — for example, Monday morning demand surges non-linearly compared to Friday afternoon. Random Forest naturally learns non-linear decision boundaries and split interactions without artificial polynomial transformations." |
| **Q2. Why not use Deep Neural Networks (LSTM/MLP)?** | "Deep learning requires tens of thousands of continuous records to avoid extreme overfitting and acts as a black box. For tabular enterprise mobility with sample sizes in the hundreds to thousands, Random Forest consistently outperforms deep networks in tabular benchmarks, trains in sub-seconds locally, requires zero GPU infrastructure, and provides mathematical feature importance." |
| **Q3. What is the difference between ML Prediction and Business Logic?** | "The ML model only solves a pure regression problem: mapping input features $X$ to expected passenger demand $\hat{y}$. The business logic is a deterministic post-processing layer that divides demand by vehicle capacity to calculate occupancy %, maps thresholds to statuses (`CRITICAL`, `HIGH`), and computes additional shuttle counts using the ceiling function $\lceil \hat{y}/\text{Cap} \rceil$." |
| **Q4. What do your evaluation metrics mean?** | "Our MAE represents the average passenger count error (e.g. 1.8 passengers). RMSE heavily penalizes large errors to reveal worst-case forecast volatility. R-squared ($R^2$) reveals the percentage of variance in passenger demand explained by our 9 features relative to a naive mean predictor." |
| **Q5. How is Feature Importance computed?** | "Every time a decision tree splits on a feature, that split reduces the variance of the target variable. We aggregate the variance reduction across all 25 trees in the forest, weighted by the number of samples reaching each node, and normalize the sum to 100%." |
| **Q6. What are the limitations of synthetic training data?** | "Synthetic data accurately captures day-of-week and trend distributions, but cannot account for unpredicted external anomalies like sudden torrential rain, metro line strikes, or local traffic accidents. In a live deployment, real GPS boardings and booking cancellations continuously replace synthetic records." |
| **Q7. Does the system change vehicle assignments automatically?** | "No. Urban fleet management requires human-in-the-loop oversight. AI provides predictive recommendations and impact alerts; the Admin retains executive authority to approve shuttle dispatch or route consolidation." |

---

## 9. Verification & Codebase Layout

```
fearless-galileo/
├── AI_DEMAND_PREDICTION.md            # Complete MCA academic documentation
├── scripts/
│   ├── train_demand_model.py          # Standalone Python scikit-learn script for viva
│   └── test-ai-prediction.ts          # Automated pipeline test script
├── src/
│   ├── app/
│   │   ├── admin/dashboard/page.tsx   # Admin dashboard embedding AI Demand Intelligence
│   │   └── api/ai/demand-prediction/  # Next.js GET & POST API route handlers
│   ├── components/
│   │   ├── admin/ai-demand-intelligence.tsx # Enterprise UI with Recharts and explainability
│   │   ├── smart-eta-card.tsx         # Reusable Smart ETA & Traffic Delay card
│   │   └── navbar.tsx                 # Top navigation with AI Demand Intelligence link
│   └── lib/
│       ├── ai/
│       │   ├── smart-eta.ts           # Real-time Smart ETA & Traffic delay prediction engine
│       │   ├── historical-data.ts     # Multi-week commute history simulator
│       │   ├── feature-engineering.ts # Data cleaning, encoding, rolling windows, lag features
│       │   ├── model.ts               # Transparent Random Forest Regressor
│       │   ├── evaluation.ts          # 80/20 train/test split, actual MAE, RMSE, R²
│       │   └── business-rules.ts      # Occupancy, shuttle math, bottlenecks, merge rules
│       └── firestore-db.ts            # Data access layer updated with AI entities
└── prisma/
    └── schema.prisma                  # AIDemandPrediction & AIModelRun Prisma models
```

---

## 10. 🚦 Smart ETA & Delay Prediction Engine (`src/lib/ai/smart-eta.ts`)

Instead of displaying passive static vehicle metrics like `Vehicle: 42 km/h`, SmartRide predicts active arrival times and corridor delay increments using GPS coordinates, route waypoints, and corridor congestion models:

### 10.1 Mathematical Formulation
1. **Haversine Remaining Distance**:
   $$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
2. **Effective Velocity ($V_{\text{eff}}$)**:
   Blends live GPS velocity with historical corridor choke-point throughput:
   $$V_{\text{eff}} = \max\left(12, 0.70 \cdot V_{\text{gps}} + 0.30 \cdot \frac{V_{\text{free\_flow}}}{C_{\text{traffic}}}\right)$$
   where $C_{\text{traffic}}$ is the peak hour congestion multiplier ($1.25$–$1.38$ during peak commute hours).
3. **Smart Delay Calculation**:
   $$\text{Delay Minutes} = \max\left(0, \left( \frac{d}{V_{\text{eff}}} \times 60 \right) - \left( \frac{d}{V_{\text{free\_flow}}} \times 60 \right)\right)$$
4. **Traffic-Adjusted ETA**:
   $$\text{Traffic ETA} = \text{Normal Scheduled ETA} + \text{Delay Minutes}$$

### 10.2 Commuter & Driver Presentation
* **Live Status Indicator**: `🟢 Arriving in 8 min` (or `🟡 Arriving in 8 min (+3m delay)`)
* **Current Delay**: `+3 min`
* **Predicted Arrival Time**: `8:43 AM`
* **Dual ETA Display**:
  - `Normal ETA: 8:40 AM`
  - `Traffic-adjusted ETA: 8:43 AM`
* **Multi-Stop Progression**: Every stop along the corridor shows its scheduled time strikethrough alongside the real-time predicted arrival time.

