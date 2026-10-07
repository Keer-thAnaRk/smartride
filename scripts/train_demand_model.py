"""
══════════════════════════════════════════════════════════════════════════════
🚗 SMARTRIDE (COMMUTESYNC) — AI ROUTE DEMAND PREDICTION (MCA VIVA PYTHON SCRIPT)
══════════════════════════════════════════════════════════════════════════════
Academic Viva Demonstration Script using Python, pandas, and scikit-learn.

This script demonstrates the identical Machine Learning pipeline implemented
in the SmartRide web application:
1. Historical Commute Dataset Loading
2. Feature Engineering & Categorical Encoding
3. Train/Test Holdout Split (80% Train, 20% Test)
4. Random Forest Regressor Model Training
5. Model Evaluation (MAE, RMSE, R-squared)
6. Feature Importance Extraction
7. Inference & Business Rule Recommendation (Occupancy & Additional Shuttles)

Requirements:
    pip install pandas numpy scikit-learn
Usage:
    python scripts/train_demand_model.py
"""

import math
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# ------------------------------------------------------------------------------
# 1. SYNTHETIC HISTORICAL DATASET GENERATION (60 Days of Corporate Commute)
# ------------------------------------------------------------------------------
def generate_synthetic_data(days_count=60, seed=42):
    np.random.seed(seed)
    records = []
    
    routes = [
        {"code": "SR-101", "name": "Whitefield Tech Express", "capacity": 20, "base_morn": 18, "base_eve": 17},
        {"code": "SR-102", "name": "Electronic City Express", "capacity": 16, "base_morn": 15, "base_eve": 14},
        {"code": "SR-103", "name": "Outer Ring Road Shuttle", "capacity": 12, "base_morn": 11, "base_eve": 10},
        {"code": "SR-104", "name": "Bannerghatta Tech Link", "capacity": 8, "base_morn": 6, "base_eve": 6},
    ]
    
    # Day-of-week multipliers (0=Sun, 1=Mon, ..., 6=Sat)
    dow_multipliers = {1: 1.15, 2: 1.08, 3: 1.02, 4: 0.96, 5: 0.76, 6: 0.20}
    
    for d in range(days_count, 0, -1):
        date = pd.Timestamp.now() - pd.Timedelta(days=d)
        dow = date.dayofweek + 1 # 1:Mon, ..., 7:Sun
        if dow == 7: # Skip Sundays
            continue
            
        dow_mult = dow_multipliers.get(dow, 1.0)
        week_of_month = min(5, (date.day // 7) + 1)
        growth_factor = 1.0 + ((days_count - d) / days_count) * 0.12
        
        for r in routes:
            for shift in ["MORNING_PICKUP", "EVENING_DROP"]:
                base = r["base_morn"] if shift == "MORNING_PICKUP" else r["base_eve"]
                shift_mult = 1.04 if shift == "MORNING_PICKUP" else 0.96
                noise = np.random.uniform(-1.8, 1.8)
                
                scheduled = max(2, int(round(base * dow_mult * shift_mult * growth_factor + noise)))
                cancellation_rate = np.random.uniform(0.04, 0.08)
                no_show_rate = np.random.uniform(0.01, 0.03)
                
                cancellations = int(round(scheduled * cancellation_rate))
                no_shows = int(round(scheduled * no_show_rate))
                actual_demand = max(1, scheduled - cancellations - no_shows)
                
                records.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "route_code": r["code"],
                    "shift": shift,
                    "day_of_week": dow,
                    "week_of_month": week_of_month,
                    "vehicle_capacity": r["capacity"],
                    "scheduled": scheduled,
                    "cancellations": cancellations,
                    "actual_demand": actual_demand,
                })
                
    return pd.DataFrame(records)

# ------------------------------------------------------------------------------
# 2. FEATURE ENGINEERING
# ------------------------------------------------------------------------------
def engineer_features(df):
    df = df.sort_values(by="date").reset_index(drop=True)
    
    # Categorical encoding
    route_mapping = {code: i for i, code in enumerate(df["route_code"].unique())}
    df["route_code_idx"] = df["route_code"].map(route_mapping)
    df["shift_idx"] = df["shift"].map({"MORNING_PICKUP": 0, "EVENING_DROP": 1})
    
    # Rolling averages and lag features
    df["historical_avg_demand"] = 0.0
    df["recent_trend_7d"] = 0.0
    df["prev_same_day_demand"] = 0.0
    df["cancellation_rate"] = 0.05
    
    for (r_code, shift), group in df.groupby(["route_code", "shift"]):
        demands = group["actual_demand"].values
        scheduled = group["scheduled"].values
        cancels = group["cancellations"].values
        indices = group.index
        
        hist_avgs = []
        recent_7d = []
        c_rates = []
        
        for i in range(len(demands)):
            if i == 0:
                hist_avgs.append(demands[0])
                recent_7d.append(demands[0])
                c_rates.append(0.05)
            else:
                hist_avgs.append(np.mean(demands[:i]))
                recent_7d.append(np.mean(demands[max(0, i-7):i]))
                c_rates.append(np.sum(cancels[:i]) / max(1, np.sum(scheduled[:i])))
                
        df.loc[indices, "historical_avg_demand"] = np.round(hist_avgs, 2)
        df.loc[indices, "recent_trend_7d"] = np.round(recent_7d, 2)
        df.loc[indices, "cancellation_rate"] = np.round(c_rates, 4)
        
        # 7-day lag (same day of week last week)
        df.loc[indices, "prev_same_day_demand"] = group["actual_demand"].shift(1).fillna(group["actual_demand"].mean())
        
    feature_cols = [
        "route_code_idx",
        "shift_idx",
        "day_of_week",
        "week_of_month",
        "vehicle_capacity",
        "historical_avg_demand",
        "recent_trend_7d",
        "prev_same_day_demand",
        "cancellation_rate"
    ]
    
    return df, feature_cols, route_mapping

# ------------------------------------------------------------------------------
# 3. MODEL TRAINING & EVALUATION
# ------------------------------------------------------------------------------
def main():
    print("=" * 75)
    print("🧠 SMARTRIDE: AI ROUTE DEMAND PREDICTION — MODEL TRAINING (MCA VIVA)")
    print("=" * 75)
    
    print("\n[1/5] Generating multi-week historical commute dataset...")
    raw_df = generate_synthetic_data(days_count=60, seed=42)
    print(f"      Loaded {len(raw_df)} historical trip records across 4 corridor routes.")
    
    print("\n[2/5] Performing feature engineering & temporal encoding...")
    df, feature_cols, route_mapping = engineer_features(raw_df)
    X = df[feature_cols].values
    y = df["actual_demand"].values
    
    print(f"      Feature Matrix Shape: {X.shape} (N={X.shape[0]} samples, P={X.shape[1]} features)")
    
    print("\n[3/5] Performing 80/20 Train/Test holdout split...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=101, shuffle=True)
    print(f"      Training set: {len(X_train)} samples | Testing set: {len(X_test)} samples")
    
    print("\n[4/5] Training RandomForestRegressor (n_estimators=25, max_depth=6)...")
    model = RandomForestRegressor(n_estimators=25, max_depth=6, min_samples_split=4, random_state=777)
    model.fit(X_train, y_train)
    print("      Model training complete.")
    
    print("\n[5/5] Evaluating model performance on holdout test set...")
    y_pred = model.predict(X_test)
    
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    print("\n" + "─" * 45)
    print("📈 EMPIRICAL EVALUATION METRICS:")
    print(f"   • Mean Absolute Error (MAE) : {mae:.2f} passengers")
    print(f"   • Root Mean Squared (RMSE)  : {rmse:.2f}")
    print(f"   • R-Squared (R²) Score      : {r2:.3f}")
    print("─" * 45)
    
    print("\n🌲 FEATURE IMPORTANCES:")
    for feat_name, imp in sorted(zip(feature_cols, model.feature_importances_), key=lambda x: x[1], reverse=True):
        print(f"   • {feat_name:<24}: {imp*100:5.1f}%")
        
    print("\n" + "=" * 75)
    print("🎯 SAMPLE PREDICTION & BUSINESS RECOMMENDATION ENGINE DEMONSTRATION:")
    print("=" * 75)
    
    # Test tomorrow morning on Route SR-101 (HSR -> ITPB, capacity 20)
    sample_features = np.array([[
        route_mapping["SR-101"], # Route Code Index
        0,                        # Shift: Morning Pickup
        1,                        # Day of week: Monday
        2,                        # Week of month: 2
        20,                       # Vehicle Capacity: 20
        18.2,                     # Historical Average: 18.2
        19.1,                     # Recent 7-Day Trend: 19.1
        19.0,                     # Previous Monday Lag: 19.0
        0.051                     # Cancellation Rate: 5.1%
    ]])
    
    predicted_pax = model.predict(sample_features)[0]
    capacity = 20
    occupancy = (predicted_pax / capacity) * 100
    
    # Business Logic
    status = "CRITICAL" if occupancy > 95 else "HIGH" if occupancy > 80 else "NORMAL" if occupancy > 50 else "LOW"
    required_vehicles = math.ceil(predicted_pax / capacity)
    extra_shuttles = max(0, required_vehicles - 1)
    
    print(f"   • Target Route           : SR-101 (Whitefield Tech Express)")
    print(f"   • Shift                  : Monday Morning Pickup (08:30 AM)")
    print(f"   • Vehicle Seat Capacity  : {capacity} seats")
    print(f"   • ML PREDICTED DEMAND    : {predicted_pax:.1f} passengers (rounded: {round(predicted_pax)})")
    print(f"   • CALCULATED OCCUPANCY   : {occupancy:.1f}%")
    print(f"   • DEMAND STATUS          : {status}")
    if extra_shuttles > 0:
        print(f"   • RECOMMENDATION         : Deploy {extra_shuttles} additional shuttle (Overflow: {predicted_pax - capacity:.1f} pax)")
    else:
        print(f"   • RECOMMENDATION         : Operating within capacity buffer.")
        
    print("\n✅ Academic Demonstration Completed Successfully.")

if __name__ == "__main__":
    main()
