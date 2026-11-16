"""
Nagrik Sahayak — Intelligent SLA Prediction
Trains and serves a Machine Learning regression pipeline (scikit-learn GradientBoostingRegressor)
predicting realistic resolution duration in hours.
Compares ML model against Baseline DummyRegressor (Mean) and records authentic MAE & RMSE metrics.
Advisory only — strictly preserves statutory SLA deadlines.
"""

import os
import sys
import json
import math
import argparse
import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "historical_grievances.json")
MODEL_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "sla_model.joblib")
METRICS_PATH = os.path.join(MODEL_DIR, "sla_metrics.json")

CATEGORICAL_FEATURES = ["category", "department", "priority", "zone"]
NUMERICAL_FEATURES = ["description_length"]

# Department mapping from full names to codes
DEPT_NAME_TO_CODE = {
    "Water Supply & Sewerage": "WATER",
    "Water Supply": "WATER",
    "Electricity & Energy": "ELEC",
    "Electricity": "ELEC",
    "Roads & Public Infrastructure": "ROAD",
    "Roads and Infrastructure": "ROAD",
    "Sanitation & Waste Management": "SANI",
    "Sanitation and Waste Management": "SANI",
    "Public Health & Healthcare": "HEALTH",
    "Public Health": "HEALTH",
    "Education & Schools": "EDU",
    "Education": "EDU",
    "Public Safety & Law Enforcement": "SAFETY",
    "Public Safety": "SAFETY",
    "Transport & Traffic Management": "TRANS",
    "Transport": "TRANS",
    "General Public Administration": "GEN",
    "Other": "GEN"
}

def train_and_evaluate():
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Training data not found at {DATA_PATH}. Run generate_training_data.py first.")
        
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    df = pd.DataFrame(data)
    print(f"[ML SLA] Loaded {len(df)} historical records for training.")
    
    X = df[CATEGORICAL_FEATURES + NUMERICAL_FEATURES]
    y = df["resolution_hours"].values
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )
    
    print(f"[ML SLA] Train samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # 1. Baseline Model: DummyRegressor (strategy='mean')
    baseline = DummyRegressor(strategy="mean")
    baseline.fit(X_train, y_train)
    y_pred_base = baseline.predict(X_test)
    
    base_mae = float(mean_absolute_error(y_test, y_pred_base))
    base_mse = float(mean_squared_error(y_test, y_pred_base))
    base_rmse = float(math.sqrt(base_mse))
    base_r2 = float(r2_score(y_test, y_pred_base))
    
    # 2. Machine Learning Pipeline: GradientBoostingRegressor
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
            ("num", StandardScaler(), NUMERICAL_FEATURES)
        ]
    )
    
    ml_model = GradientBoostingRegressor(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=4,
        random_state=42
    )
    
    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", ml_model)
    ])
    
    pipeline.fit(X_train, y_train)
    y_pred_ml = pipeline.predict(X_test)
    
    ml_mae = float(mean_absolute_error(y_test, y_pred_ml))
    ml_mse = float(mean_squared_error(y_test, y_pred_ml))
    ml_rmse = float(math.sqrt(ml_mse))
    ml_r2 = float(r2_score(y_test, y_pred_ml))
    
    mae_improvement_pct = round(((base_mae - ml_mae) / base_mae) * 100.0, 2)
    rmse_improvement_pct = round(((base_rmse - ml_rmse) / base_rmse) * 100.0, 2)
    
    metrics = {
        "dataset": {
            "total_records": len(df),
            "train_samples": len(X_train),
            "test_samples": len(X_test)
        },
        "baseline": {
            "name": "DummyRegressor (Mean Baseline)",
            "mae": round(base_mae, 2),
            "rmse": round(base_rmse, 2),
            "r2": round(base_r2, 4)
        },
        "model": {
            "name": "GradientBoostingRegressor Pipeline",
            "mae": round(ml_mae, 2),
            "rmse": round(ml_rmse, 2),
            "r2": round(ml_r2, 4)
        },
        "evaluation": {
            "mae_reduction_pct": mae_improvement_pct,
            "rmse_reduction_pct": rmse_improvement_pct,
            "status": "SUPERIOR_TO_BASELINE" if ml_mae < base_mae else "INFERIOR"
        }
    }
    
    # Save model and metrics
    joblib.dump(pipeline, MODEL_PATH)
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
        
    print("\n================ ML SLA MODEL EVALUATION REPORT ================")
    print(f"Total Dataset Records: {len(df)} (Train: {len(X_train)}, Test: {len(X_test)})")
    print("----------------------------------------------------------------")
    print(f"Baseline (Mean):  MAE = {base_mae:.2f} hrs | RMSE = {base_rmse:.2f} hrs | R2 = {base_r2:.4f}")
    print(f"ML Model (GBR):   MAE = {ml_mae:.2f} hrs | RMSE = {ml_rmse:.2f} hrs | R2 = {ml_r2:.4f}")
    print("----------------------------------------------------------------")
    print(f"MAE Improvement:  {mae_improvement_pct}% error reduction over baseline")
    print(f"RMSE Improvement: {rmse_improvement_pct}% error reduction over baseline")
    print(f"Saved Trained Model: {MODEL_PATH}")
    print(f"Saved Metrics File:  {METRICS_PATH}")
    print("================================================================\n")
    
    return metrics

def predict_single(input_data):
    if not os.path.exists(MODEL_PATH):
        # Auto-train if model does not exist yet
        train_and_evaluate()
        
    pipeline = joblib.load(MODEL_PATH)
    
    # Normalize department to code
    raw_dept = input_data.get("department", "")
    dept_code = DEPT_NAME_TO_CODE.get(raw_dept, raw_dept)
    if not dept_code:
        dept_code = DEPT_NAME_TO_CODE.get(input_data.get("category", ""), "GEN")
        
    category = input_data.get("category", "Other")
    priority = input_data.get("priority", "Medium")
    zone = input_data.get("zone", "Central")
    desc_len = int(input_data.get("description_length", input_data.get("desc_len", 120)))
    
    row = pd.DataFrame([{
        "category": category,
        "department": dept_code,
        "priority": priority,
        "zone": zone,
        "description_length": desc_len
    }])
    
    pred_hours = float(pipeline.predict(row)[0])
    pred_hours = max(4.0, min(140.0, round(pred_hours, 1)))
    pred_days = round(pred_hours / 24.0, 1)
    
    # Confidence level heuristic based on training domain
    confidence = "High" if priority in ["Urgent", "High", "Medium"] and category in DEPT_NAME_TO_CODE else "Medium"
    
    return {
        "success": True,
        "predictedHours": pred_hours,
        "predictedDays": pred_days,
        "confidenceLevel": confidence,
        "modelType": "GradientBoostingRegressor",
        "isAdvisoryOnly": True
    }

def main():
    parser = argparse.ArgumentParser(description="Nagrik Sahayak SLA ML Predictor")
    parser.add_argument("--train", action="store_true", help="Train and evaluate regression model")
    parser.add_argument("--predict", type=str, help="Predict single complaint SLA from JSON string")
    args = parser.parse_args()
    
    if args.train:
        train_and_evaluate()
        return
        
    if args.predict:
        try:
            payload = json.loads(args.predict)
            result = predict_single(payload)
            print(json.dumps(result))
            return
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
            return
            
    # If JSON passed via stdin
    try:
        raw_stdin = sys.stdin.read().strip()
        if raw_stdin:
            payload = json.loads(raw_stdin)
            result = predict_single(payload)
            print(json.dumps(result))
            return
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        return

    # Default action if no args
    train_and_evaluate()

if __name__ == "__main__":
    main()
