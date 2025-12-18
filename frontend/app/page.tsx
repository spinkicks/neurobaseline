"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Particles from "@/components/Particles";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Point = { t: string; value: number };
type Explanation = { t: string; severity: string; text: string };

type Results = {
  nvi: Point[];
  change_points: string[];
  features: Record<string, Point[]>;
  explanations: Explanation[];
};

// Stat card component
function StatCard({
  label,
  value,
  suffix,
  trend,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: "up" | "down" | "neutral";
}) {
  const trendColors = {
    up: "#22c55e",
    down: "#ef4444",
    neutral: "#71717a",
  };
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {suffix && <span className="stat-suffix">{suffix}</span>}
      </span>
      {trend && (
        <span className="stat-trend" style={{ color: trendColors[trend] }}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}
        </span>
      )}
      <style jsx>{`
        .stat-card {
          background: transparent;
          border: 1px solid #27272a;
          border-radius: 16px;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: all 0.2s ease;
        }
        .stat-card:hover {
          border-color: #3f3f46;
          transform: translateY(-2px);
        }
        .stat-label {
          font-size: 13px;
          color: #71717a;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #fafafa;
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .stat-suffix {
          font-size: 16px;
          color: #71717a;
          font-weight: 500;
        }
        .stat-trend {
          font-size: 14px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

// Severity badge component
function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    high: { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
    medium: { bg: "rgba(245, 158, 11, 0.1)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" },
    low: { bg: "rgba(34, 197, 94, 0.1)", text: "#22c55e", border: "rgba(34, 197, 94, 0.3)" },
  };
  const color = colors[severity.toLowerCase()] || colors.low;

  return (
    <span
      style={{
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
        padding: "4px 10px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {severity}
    </span>
  );
}

export default function Home() {
  const [data, setData] = useState<Results | null>(null);
  const [featureKey, setFeatureKey] = useState<string>("rt_var");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
  setIsLoading(true);

  fetch("http://127.0.0.1:8000/results")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((j) => {
      setData(j);          // IMPORTANT: because /results returns the object directly
      setIsLoading(false);
    })
    .catch((e) => {
      console.error("Failed to load API results:", e);
      setIsLoading(false);
    });
}, []);



  const featureOptions = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.features || {});
  }, [data]);

  useEffect(() => {
    if (featureOptions.length && !featureOptions.includes(featureKey)) {
      setFeatureKey(featureOptions[0]);
    }
  }, [featureOptions, featureKey]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!data?.nvi?.length) return null;
    const values = data.nvi.map((p) => p.value);
    const current = values[values.length - 1];
    const prev = values[values.length - 2] ?? current;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const trend = current > prev ? "up" : current < prev ? "down" : "neutral";
    return {
      current: Math.round(current),
      avg: Math.round(avg),
      trend,
      changePoints: data.change_points?.length || 0,
    };
  }, [data]);

  const lastAnalyzed =
    data?.nvi?.length ? data.nvi[data.nvi.length - 1].t : "—";

  // Dark theme for Plotly
  const plotLayout = {
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { color: "#a1a1aa", family: "Inter, sans-serif" },
    xaxis: {
      gridcolor: "#27272a",
      linecolor: "#27272a",
      zerolinecolor: "#27272a",
    },
    yaxis: {
      gridcolor: "#27272a",
      linecolor: "#27272a",
      zerolinecolor: "#27272a",
    },
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <span className="logo-text">Neurobaseline</span>
          </div>
          <div className="loading-spinner" />
          <p>Loading neural data...</p>
        </div>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(180deg, #09090b 0%, #0f0f12 100%);
          }
          .loading-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
          }
          .loading-logo {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-icon {
            font-size: 32px;
            color: #6366f1;
          }
          .logo-text {
            font-size: 24px;
            font-weight: 700;
            color: #fafafa;
          }
          .loading-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #27272a;
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
          p {
            color: #71717a;
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#71717a" }}>
        <p>Failed to load results.json</p>
      </div>
    );
  }

  const nviX = data.nvi.map((p) => p.t);
  const nviY = data.nvi.map((p) => p.value);

  const shapes =
    data.change_points?.map((cp) => ({
      type: "line" as const,
      x0: cp,
      x1: cp,
      y0: 0,
      y1: 100,
      xref: "x" as const,
      yref: "y" as const,
      line: { width: 2, dash: "dot" as const, color: "#6366f1" },
    })) ?? [];

  const featSeries = data.features?.[featureKey] ?? [];
  const featX = featSeries.map((p) => p.t);
  const featY = featSeries.map((p) => p.value);

  return (
    <div className="dashboard">
      <Particles className="particles-container" />
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="status-indicator" />
          <span className="status-text">Live</span>
          <span className="status-text" style={{ marginLeft: 10 }}>
            Last analyzed: {lastAnalyzed}
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <h1>Neurobaseline</h1>
        <p>Cognitive Stability Dashboard: Real-time neural variability tracking and analysis powered by machine learning</p>
      </section>

      {/* Stats row */}
      {stats && (
        <>
          <section className="stats-row">
            <StatCard label="Current NVI" value={stats.current} suffix="/100" trend={stats.trend} />
            <StatCard label="Average NVI" value={stats.avg} suffix="/100" />
            <StatCard label="Change Points" value={stats.changePoints} />
            <StatCard label="Features Tracked" value={featureOptions.length} />
          </section>

          <p className="stats-explainer">
            NVI reflects stability relative to your personal baseline. Anomaly score reflects day-to-day deviation magnitude.
          </p>
        </>
      )}

      {/* Main grid */}
      <div className="main-grid">
        {/* NVI Chart */}
        <section className="card card-large">
          <div className="card-header">
            <h2>Neuro Variability Index</h2>
            <span className="card-subtitle">Cognitive stability over time (0–100 scale)</span>
          </div>
          <div className="chart-container">
            <Plot
              data={[
                {
                  x: nviX,
                  y: nviY,
                  type: "scatter",
                  mode: "lines",
                  name: "NVI",
                  line: { color: "#6366f1", width: 2.5 },
                  fill: "tozeroy",
                  fillcolor: "rgba(99, 102, 241, 0.1)",
                },
              ]}
              layout={{
                ...plotLayout,
                height: 380,
                margin: { l: 50, r: 24, t: 16, b: 50 },
                yaxis: { ...plotLayout.yaxis, range: [0, 100], title: { text: "Stability", font: { size: 12 } } },
                xaxis: { ...plotLayout.xaxis, title: { text: "Date", font: { size: 12 } } },
                shapes,
                showlegend: false,
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </section>

        {/* Insights panel */}
        <section className="card card-insights">
          <div className="card-header">
            <h2>Insights</h2>
            <span className="card-subtitle">Detected changes & explanations</span>
          </div>
          <div className="insights-list">
            {data.explanations?.length ? (
              data.explanations.map((ex, idx) => (
                <div key={idx} className="insight-item">
                  <div className="insight-header">
                    <span className="insight-date">{ex.t}</span>
                    <SeverityBadge severity={ex.severity} />
                  </div>
                  <p className="insight-text">{ex.text}</p>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon">✓</span>
                <p>No significant changes detected</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Feature drill-down */}
      <section className="card">
        <div className="card-header card-header-row">
          <div>
            <h2>Feature Analysis</h2>
            <span className="card-subtitle">Drill down into individual metrics</span>
          </div>
          <div className="feature-select">
            <label htmlFor="feature-select">Feature</label>
            <select id="feature-select" value={featureKey} onChange={(e) => setFeatureKey(e.target.value)}>
              {featureOptions.map((k) => (
                <option key={k} value={k}>
                  {k.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="chart-container">
          <Plot
            data={[
              {
                x: featX,
                y: featY,
                type: "scatter",
                mode: "lines+markers",
                name: featureKey,
                line: { color: "#22c55e", width: 2 },
                marker: { size: 6, color: "#22c55e" },
              },
            ]}
            layout={{
              ...plotLayout,
              height: 320,
              margin: { l: 50, r: 24, t: 16, b: 50 },
              xaxis: { ...plotLayout.xaxis, title: { text: "Date", font: { size: 12 } } },
              yaxis: { ...plotLayout.yaxis, title: { text: featureKey.replace(/_/g, " "), font: { size: 12 } } },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>Built by David and Haren • Neurobaseline © 2025</p>
      </footer>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: relative;
          z-index: 2;
        }

        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-icon {
          font-size: 28px;
          color: #6366f1;
        }
        .logo-text {
          font-size: 22px;
          font-weight: 700;
          color: #fafafa;
          letter-spacing: -0.5px;
        }
        .badge {
          background: #6366f1;
          color: white;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .status-indicator {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .status-text {
          font-size: 13px;
          color: #71717a;
          font-weight: 500;
        }

        /* Hero */
        .hero {
          text-align: center;
          padding: 48px 24px;
          background: transparent;
          border-radius: 24px;
          border: 1px solid #27272a;
        }
        .hero h1 {
          font-size: 36px;
          font-weight: 800;
          color: #fafafa;
          margin: 0 0 12px 0;
          letter-spacing: -1px;
        }
        .hero p {
          font-size: 16px;
          color: #71717a;
          margin: 0;
          max-width: 500px;
          margin: 0 auto;
        }

        /* Stats */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .stats-explainer {
          margin: 8px 2px 0;
          font-size: 12px;
          color: #71717a;
        }

        /* Cards */
        .card {
          background: transparent;
          border: 1px solid #27272a;
          border-radius: 20px;
          padding: 24px;
          transition: border-color 0.2s ease;
        }
        .card:hover {
          border-color: #3f3f46;
        }
        .card-header {
          margin-bottom: 20px;
        }
        .card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
        }
        .card-header h2 {
          font-size: 18px;
          font-weight: 700;
          color: #fafafa;
          margin: 0 0 4px 0;
        }
        .card-subtitle {
          font-size: 13px;
          color: #71717a;
        }
        .chart-container {
          margin: 0 -12px;
        }

        /* Main grid */
        .main-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Insights */
        .card-insights {
          max-height: 480px;
          display: flex;
          flex-direction: column;
        }
        .insights-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-right: 8px;
        }
        .insight-item {
          background: transparent;
          border: 1px solid #27272a;
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s ease;
        }
        .insight-item:hover {
          border-color: #3f3f46;
          background: rgba(37, 37, 41, 0.5);
        }
        .insight-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .insight-date {
          font-size: 12px;
          color: #71717a;
          font-weight: 500;
        }
        .insight-text {
          font-size: 14px;
          color: #d4d4d8;
          margin: 0;
          line-height: 1.5;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
        }
        .empty-icon {
          font-size: 32px;
          color: #22c55e;
          margin-bottom: 12px;
        }
        .empty-state p {
          color: #71717a;
          margin: 0;
        }

        /* Feature select */
        .feature-select {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .feature-select label {
          font-size: 13px;
          color: #71717a;
          font-weight: 500;
        }

        /* Footer */
        .footer {
          text-align: center;
          padding: 32px 0;
          border-top: 1px solid #27272a;
          margin-top: 24px;
        }
        .footer p {
          font-size: 13px;
          color: #52525b;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

