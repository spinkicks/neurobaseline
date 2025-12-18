"""
Run the pipeline that produces `results.json`.

This script (by default) synthesizes typing data, extracts features, computes a
stability score (NVI), detects change-points, and runs a simple ML-based
anomaly detector. It then builds human-readable explanations and writes a
`results.json` file (used by the API and frontend).

Run standalone with: python run_pipeline.py
Or invoke it from the API to refresh backend/results.json.
"""

import json
import numpy as np
import pandas as pd
from scipy.stats import median_abs_deviation
import ruptures as rpt
from statsmodels.tsa.holtwinters import ExponentialSmoothing

# ML (unsupervised anomaly detection)
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


# synthetic data

def make_synth(n_days: int = 30, drift_day: int = 20, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dates = pd.date_range(end=pd.Timestamp.today().normalize(), periods=n_days, freq="D")

    # baseline signals
    rt = rng.normal(320, 18, size=n_days)          # reaction time ms
    iki = rng.normal(145, 9, size=n_days)          # inter-key interval ms
    bs = np.clip(rng.normal(0.06, 0.015, size=n_days), 0, 0.25)  # backspace rate

    # inject drift higher variability and mild shifts
    idx = drift_day - 1
    rt[idx:] += rng.normal(0, 25, size=n_days - idx)
    iki[idx:] += rng.normal(0, 14, size=n_days - idx)
    bs[idx:] = np.clip(bs[idx:] + rng.normal(0.03, 0.02, size=n_days - idx), 0, 0.4)

    return pd.DataFrame({"t": dates, "rt_ms": rt, "iki_ms": iki, "backspace_rate": bs})


# feature extraction

def add_features(df: pd.DataFrame, window: int = 7) -> pd.DataFrame:
    d = df.sort_values("t").reset_index(drop=True).copy()

    # rolling variances and rolling mean for backspace
    d["rt_var"] = d["rt_ms"].rolling(window, min_periods=3).var()
    d["iki_var"] = d["iki_ms"].rolling(window, min_periods=3).var()
    d["bs_mean"] = d["backspace_rate"].rolling(window, min_periods=3).mean()

    # fill edges where rolling window is small
    d[["rt_var", "iki_var", "bs_mean"]] = d[["rt_var", "iki_var", "bs_mean"]].bfill().ffill()
    return d


# baseline and nvi (100 = most stable)

# robust z scoring using median absolute deviation for robustness to outliers
def robust_z(series: pd.Series, base: pd.Series) -> pd.Series:
    center = float(np.median(base))
    scale = float(median_abs_deviation(base, scale="normal") + 1e-9)
    return (series - center) / scale


def compute_nvi(d: pd.DataFrame, baseline_days: int = 10) -> pd.DataFrame:
    out = d.copy()
    base = out.iloc[:baseline_days]

    z_rt = robust_z(out["rt_var"], base["rt_var"])
    z_iki = robust_z(out["iki_var"], base["iki_var"])
    z_bs = robust_z(out["bs_mean"], base["bs_mean"])

    # only penalize "worse-than-baseline" (positive drift)
    p_rt = z_rt.clip(lower=0)
    p_iki = z_iki.clip(lower=0)
    p_bs = z_bs.clip(lower=0)

    # weighted drift score
    drift = 0.45 * p_rt + 0.35 * p_iki + 0.20 * p_bs
    out["drift_raw"] = drift

    # smooth drift to avoid single day spikes using exponential smoothing
    try:
        fit = ExponentialSmoothing(drift, trend=None, seasonal=None, initialization_method="estimated").fit()
        out["drift_smooth"] = fit.fittedvalues
    except Exception:
        # fallback to raw drift if smoothing fails
        out["drift_smooth"] = out["drift_raw"]

    # Convert drift -> stability score (100 = most stable)
    out["nvi"] = (100 * np.exp(-out["drift_smooth"])).clip(0, 100)
    return out


# change-point detection on NVI
def change_points_from_series(series: pd.Series, pen: float = 8.0) -> list[int]:
    y = series.to_numpy().reshape(-1, 1)
    algo = rpt.Pelt(model="rbf").fit(y)
    cps = algo.predict(pen=pen)  # predict returns list including terminal index
    cps = [cp for cp in cps if cp < len(series)]  # remove terminal index
    return cps


# explanations (rule-based)
def build_explanations(d: pd.DataFrame, cps: list[int], baseline_days: int = 10) -> list[dict]:
    base = d.iloc[:baseline_days]
    base_rt = float(base["rt_var"].median())
    base_iki = float(base["iki_var"].median())
    base_bs = float(base["bs_mean"].median())

    expl = []
    for cp in cps[:2]:  # keep 1 to 2 explanations
        row = d.iloc[cp]

        # % change vs baseline
        rt_pct = (row["rt_var"] - base_rt) / (base_rt + 1e-9) * 100
        iki_pct = (row["iki_var"] - base_iki) / (base_iki + 1e-9) * 100
        bs_pct = (row["bs_mean"] - base_bs) / (base_bs + 1e-9) * 100

        drivers = {
            "Reaction-time variability": rt_pct,
            "Typing variability": iki_pct,
            "Correction frequency": bs_pct,
        }
        top_name = max(drivers, key=lambda k: drivers[k])
        top_val = drivers[top_name]

        severity = "low"
        if top_val > 25:
            severity = "medium"
        if top_val > 60:
            severity = "high"

        expl.append({
            "t": row["t"].date().isoformat(),
            "severity": severity,
            "tag": "rules",
            "text": f"{top_name} increased {top_val:.0f}% vs baseline. This suggests reduced stability compared to your usual pattern."
        })
    return expl


# convert df column to timepoints
def to_timepoints(d: pd.DataFrame, col: str) -> list[dict]:
    return [{"t": t.date().isoformat(), "value": float(v)} for t, v in zip(d["t"], d[col])]


# ml anomaly scoring (isolation forest) and driver attribution
# train isolation forest on baseline then score all days and attribute driver by z score
def build_ml_series(scored: pd.DataFrame, baseline_days: int) -> tuple[list[dict], list[dict]]:
    # feature matrix
    X = np.column_stack([
        scored["rt_var"].to_numpy(),
        scored["iki_var"].to_numpy(),
        scored["bs_mean"].to_numpy()
    ])

    ml_series: list[dict] = []
    ml_explanations: list[dict] = []

    # need enough days to train and score
    if len(X) <= baseline_days + 2:
        return ml_series, ml_explanations

    # scale using baseline only
    scaler = StandardScaler()
    X_base = scaler.fit_transform(X[:baseline_days])
    X_all = scaler.transform(X)

    model = IsolationForest(n_estimators=200, random_state=42, contamination="auto")
    model.fit(X_base)

    # higher means more anomalous so flip sign
    raw = -model.score_samples(X_all)

    # normalize to 0-100
    scores = (raw - raw.min()) / (raw.max() - raw.min() + 1e-9) * 100

    # driver attribution via z-score vs baseline
    base_mean = X[:baseline_days].mean(axis=0)
    base_std = X[:baseline_days].std(axis=0) + 1e-9
    z = (X - base_mean) / base_std

    # feature names correspond to columns in X
    feat_names = ["rt_var", "iki_var", "bs_mean"]

    # map feature to tag
    def tag_for(feature_name: str) -> str:
        if feature_name == "rt_var":
            return "attention"
        if feature_name == "iki_var":
            return "motor"
        return "fatigue"
    for i, tstamp in enumerate(scored["t"]):
        day = tstamp.date().isoformat()
        s = float(scores[i])

        ml_series.append({"t": day, "value": s})

        # pick biggest absolute baseline deviation as "driver"
        j = int(np.argmax(np.abs(z[i])))
        driver = feat_names[j]
        driver_z = float(z[i][j])

        sev = "high" if s >= 70 else "medium" if s >= 40 else "low"
        ml_explanations.append({
            "t": day,
            "severity": sev,
            "tag": tag_for(driver),
            "text": f"ML anomaly score {s:.1f}/100. Biggest driver: {driver} ({driver_z:+.1f}σ vs baseline)."
        })

    return ml_series, ml_explanations


def main():
    user_id = "user_123"
    n_days = 30
    drift_day = 20
    baseline_days = 10

    df = make_synth(n_days=n_days, drift_day=drift_day)
    feat = add_features(df, window=7)
    scored = compute_nvi(feat, baseline_days=baseline_days)

    cps_idx = change_points_from_series(scored["nvi"], pen=8.0)
    cps_dates = [scored.iloc[i]["t"].date().isoformat() for i in cps_idx]

    ml_series, ml_explanations = build_ml_series(scored, baseline_days=baseline_days)
    rule_explanations = build_explanations(scored, cps_idx, baseline_days=baseline_days)

    result = {
        "meta": {"user_id": user_id, "range": f"{n_days}d"},
        "nvi": to_timepoints(scored, "nvi"),
        "change_points": cps_dates,
        "features": {
            "rt_var": to_timepoints(scored, "rt_var"),
            "iki_var": to_timepoints(scored, "iki_var"),
            "backspace_rate": to_timepoints(scored, "bs_mean"),
        },
        "ml": ml_series,
        "ml_explanations": ml_explanations,
        # keep ui working without frontend edits
        "explanations": rule_explanations + ml_explanations,
    }
    with open("results.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("Wrote results.json")


if __name__ == "__main__":
    main()
