"""
ML Training Pipeline — train.py
=================================
Production training script with:
  • Real data ingestion from PostgreSQL (falls back to synthetic)
  • k-fold cross-validation (k=5)
  • Train / validation / test split (70/15/15)
  • MAE, RMSE, R² metrics per fold and overall
  • Model versioning with metadata JSON (MLflow-compatible naming)
  • Feature importance report
  • Argument parsing for CLI usage

Usage:
    python train.py                         # Train with default settings
    python train.py --model xgboost         # Specify model type
    python train.py --data data.csv         # Train from local CSV
    python train.py --folds 10 --seed 123   # Custom k-fold / seed
"""

import os
import sys
import json
import argparse
import hashlib
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import KFold, train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from dotenv import load_dotenv

load_dotenv()

# Optional imports
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

try:
    import psycopg2
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MODEL_DIR = Path("models")
METADATA_DIR = Path("models/metadata")
FEATURE_NAMES = ["taskSize", "taskType", "priority", "resourceLoad"]

SIZE_MAP = {"SMALL": 1, "MEDIUM": 2, "LARGE": 3}
TYPE_MAP = {"CPU": 1, "IO": 2, "MIXED": 3}


def parse_args():
    p = argparse.ArgumentParser(description="Train ML task-time predictor")
    p.add_argument("--model", choices=["random_forest", "xgboost", "gradient_boosting"],
                    default="random_forest", help="Model algorithm")
    p.add_argument("--data", type=str, default=None,
                    help="Path to CSV with columns: taskSize,taskType,priority,resourceLoad,actualTime")
    p.add_argument("--folds", type=int, default=5, help="Number of CV folds")
    p.add_argument("--seed", type=int, default=42, help="Random seed")
    p.add_argument("--test-size", type=float, default=0.15, help="Held-out test fraction")
    p.add_argument("--output", type=str, default=None, help="Custom output model path")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
def load_from_postgres() -> pd.DataFrame | None:
    """Load (task, scheduleHistory) rows that have actualTime from the DB."""
    if not POSTGRES_AVAILABLE:
        print("⚠️  psycopg2 not installed — cannot load from PostgreSQL")
        return None

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("⚠️  DATABASE_URL not set — skipping PostgreSQL")
        return None

    try:
        conn = psycopg2.connect(db_url)
        query = """
            SELECT
                CASE t.size WHEN 'SMALL' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END AS "taskSize",
                CASE t.type WHEN 'CPU' THEN 1 WHEN 'IO' THEN 2 ELSE 3 END AS "taskType",
                t.priority,
                r."currentLoad" AS "resourceLoad",
                t."actualTime"
            FROM "Task" t
            JOIN "Resource" r ON t."resourceId" = r.id
            WHERE t."actualTime" IS NOT NULL
              AND t."deletedAt" IS NULL
        """
        df = pd.read_sql(query, conn)
        conn.close()
        if len(df) >= 20:
            print(f"✅ Loaded {len(df)} rows from PostgreSQL")
            return df
        else:
            print(f"⚠️  Only {len(df)} rows in DB — need at least 20, falling back to synthetic")
            return None
    except Exception as e:
        print(f"⚠️  PostgreSQL query failed: {e}")
        return None


def load_from_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {"taskSize", "taskType", "priority", "resourceLoad", "actualTime"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV missing columns: {missing}")
    print(f"✅ Loaded {len(df)} rows from {path}")
    return df


def generate_synthetic(n: int = 2000, seed: int = 42) -> pd.DataFrame:
    """Realistic synthetic data with non-linear interactions."""
    rng = np.random.RandomState(seed)
    task_size = rng.choice([1, 2, 3], n)
    task_type = rng.choice([1, 2, 3], n)
    priority = rng.choice([1, 2, 3, 4, 5], n)
    resource_load = rng.uniform(0, 100, n)

    base_time = task_size * 2.0
    type_mod = np.where(task_type == 1, 1.0, np.where(task_type == 2, 1.3, 1.15))
    load_mod = 1 + (resource_load / 100) * 0.5
    pri_mod = 1 - (priority - 3) * 0.02
    noise = rng.normal(0, 0.5, n)
    actual_time = np.maximum(base_time * type_mod * load_mod * pri_mod + noise, 0.5)

    print(f"⚠️  Using synthetic data ({n} samples) — replace with real data for production accuracy")
    return pd.DataFrame({
        "taskSize": task_size,
        "taskType": task_type,
        "priority": priority,
        "resourceLoad": resource_load,
        "actualTime": actual_time,
    })


# ---------------------------------------------------------------------------
# Model factory
# ---------------------------------------------------------------------------
def build_model(model_type: str, seed: int):
    if model_type == "xgboost":
        if not XGBOOST_AVAILABLE:
            raise RuntimeError("xgboost not installed")
        return xgb.XGBRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.08,
            min_child_weight=2, subsample=0.8, colsample_bytree=0.8,
            random_state=seed, n_jobs=-1,
        )
    elif model_type == "gradient_boosting":
        return GradientBoostingRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.08,
            min_samples_split=5, min_samples_leaf=2, random_state=seed,
        )
    else:
        return RandomForestRegressor(
            n_estimators=200, max_depth=12, min_samples_split=5,
            min_samples_leaf=2, random_state=seed, n_jobs=-1,
        )


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------
def train(args):
    # 1. Load data
    if args.data:
        df = load_from_csv(args.data)
    else:
        df = load_from_postgres()
        if df is None:
            df = generate_synthetic(seed=args.seed)

    X = df[FEATURE_NAMES].values
    y = df["actualTime"].values

    # 2. Hold-out test split
    X_dev, X_test, y_dev, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed
    )
    print(f"\n📊 Data split: {len(X_dev)} dev / {len(X_test)} test")

    # 3. k-fold cross-validation on dev set
    kf = KFold(n_splits=args.folds, shuffle=True, random_state=args.seed)
    fold_metrics = []

    for fold, (train_idx, val_idx) in enumerate(kf.split(X_dev), 1):
        X_tr, X_val = X_dev[train_idx], X_dev[val_idx]
        y_tr, y_val = y_dev[train_idx], y_dev[val_idx]

        model = build_model(args.model, args.seed)
        model.fit(X_tr, y_tr)
        y_pred = model.predict(X_val)

        mae = mean_absolute_error(y_val, y_pred)
        rmse = float(np.sqrt(mean_squared_error(y_val, y_pred)))
        r2 = r2_score(y_val, y_pred)
        fold_metrics.append({"fold": fold, "mae": mae, "rmse": rmse, "r2": r2})
        print(f"  Fold {fold}/{args.folds}: MAE={mae:.4f}  RMSE={rmse:.4f}  R²={r2:.4f}")

    avg = {
        "mae": float(np.mean([m["mae"] for m in fold_metrics])),
        "rmse": float(np.mean([m["rmse"] for m in fold_metrics])),
        "r2": float(np.mean([m["r2"] for m in fold_metrics])),
    }
    print(f"\n📈 CV Average: MAE={avg['mae']:.4f}  RMSE={avg['rmse']:.4f}  R²={avg['r2']:.4f}")

    # 4. Final model trained on full dev set, evaluated on held-out test
    final_model = build_model(args.model, args.seed)
    final_model.fit(X_dev, y_dev)
    y_test_pred = final_model.predict(X_test)

    test_metrics = {
        "mae": float(mean_absolute_error(y_test, y_test_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_test, y_test_pred))),
        "r2": float(r2_score(y_test, y_test_pred)),
    }
    print(f"\n🧪 Test set: MAE={test_metrics['mae']:.4f}  RMSE={test_metrics['rmse']:.4f}  R²={test_metrics['r2']:.4f}")

    # 5. Feature importance
    importance = {}
    if hasattr(final_model, "feature_importances_"):
        for name, imp in zip(FEATURE_NAMES, final_model.feature_importances_):
            importance[name] = round(float(imp), 4)
        print(f"\n🔍 Feature Importance: {importance}")

    # 6. Save model + metadata
    version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
    model_path = Path(args.output) if args.output else MODEL_DIR / "task_predictor.joblib"
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

    joblib.dump({
        "model": final_model,
        "version": version,
        "model_type": args.model,
    }, model_path)

    # Data fingerprint (hash of sorted unique rows) for reproducibility
    data_hash = hashlib.sha256(
        df.sort_values(list(df.columns)).to_csv(index=False).encode()
    ).hexdigest()[:12]

    metadata = {
        "version": version,
        "model_type": args.model,
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "data_source": args.data or ("postgresql" if POSTGRES_AVAILABLE else "synthetic"),
        "data_hash": data_hash,
        "data_rows": len(df),
        "dev_rows": len(X_dev),
        "test_rows": len(X_test),
        "k_folds": args.folds,
        "seed": args.seed,
        "cv_metrics": avg,
        "test_metrics": test_metrics,
        "fold_details": fold_metrics,
        "feature_importance": importance,
        "features": FEATURE_NAMES,
    }

    meta_path = METADATA_DIR / f"{version}.json"
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n💾 Model saved: {model_path}")
    print(f"📋 Metadata saved: {meta_path}")
    print(f"🏷️  Version: {version}")

    return metadata


if __name__ == "__main__":
    args = parse_args()
    train(args)
