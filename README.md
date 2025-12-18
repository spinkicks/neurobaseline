# NeuroSentinel (Neuro Variability Index)

NeuroSentinel is a lightweight neuro-behavioral screening prototype that tracks
personalized stability over time and detects persistent drift using transparent
statistical methods.

## What it does
- Builds a personalized baseline for each user
- Tracks variability in:
  - Reaction-time consistency
  - Typing rhythm (inter-key interval)
  - Correction frequency (backspace rate)
- Uses change-point detection to flag statistically significant drift
- Outputs an interpretable Neuro Variability Index (NVI)

## Tech Stack
- Python: NumPy, Pandas, SciPy, statsmodels
- Change-point detection: ruptures
- Visualization: Plotly
- Frontend: React / Next.js

## Important Note
This project is **not a diagnostic or medical tool**.
It provides screening-level insights only, reporting statistical irregularity
relative to a user’s own baseline.

## Repo Structure
- `backend/` – data pipeline and NVI computation
- `frontend/` – visualization dashboard

## UN SDGs
- SDG 3: Good Health & Well-Being
- SDG 10: Reduced Inequalities

## Credits
- Concept & ML: Haren  
- Full-stack engineering: Haren & David

