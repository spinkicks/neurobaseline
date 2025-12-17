"use client";

import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";

type Point = { t: string; value: number };
type Explanation = { t: string; severity: string; text: string };

type Results = {
  nvi: Point[];
  change_points: string[];
  features: Record<string, Point[]>;
  explanations: Explanation[];
};

export default function Home() {
  const [data, setData] = useState<Results | null>(null);
  const [featureKey, setFeatureKey] = useState<string>("rt_var");

  useEffect(() => {
    fetch("/results.json")
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch((e) => console.error(e));
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

  if (!data) return <div style={{ padding: 24 }}>Loading results.json…</div>;

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
      line: { width: 2, dash: "dot" as const },
    })) ?? [];

  const featSeries = data.features?.[featureKey] ?? [];
  const featX = featSeries.map((p) => p.t);
  const featY = featSeries.map((p) => p.value);

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>NeuroSentinel — NVI Dashboard</h1>

      {/* 3-panel layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* A) Big chart */}
        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <h2 style={{ margin: "0 0 8px 0" }}>Neuro Variability Index (0–100)</h2>
          <Plot
            data={[
              {
                x: nviX,
                y: nviY,
                type: "scatter",
                mode: "lines+markers",
                name: "NVI",
              },
            ]}
            layout={{
              height: 420,
              margin: { l: 50, r: 20, t: 20, b: 50 },
              yaxis: { range: [0, 100], title: "Stability" },
              xaxis: { title: "Date" },
              shapes,
            }}
            config={{ displayModeBar: false }}
            style={{ width: "100%" }}
          />
        </div>

        {/* B) What changed panel */}
        <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
          <h2 style={{ margin: "0 0 8px 0" }}>What changed?</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {data.explanations?.length ? (
              data.explanations.map((ex, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid #444",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    {ex.t} • <b>{ex.severity}</b>
                  </div>
                  <div style={{ marginTop: 6 }}>{ex.text}</div>
                </div>
              ))
            ) : (
              <div style={{ opacity: 0.8 }}>
                No explanations found in results.json.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* C) Drill-down */}
      <div style={{ border: "1px solid #333", borderRadius: 12, padding: 12 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>Feature drill-down</h2>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Feature:
            <select
              value={featureKey}
              onChange={(e) => setFeatureKey(e.target.value)}
            >
              {featureOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Plot
          data={[
            {
              x: featX,
              y: featY,
              type: "scatter",
              mode: "lines+markers",
              name: featureKey,
            },
          ]}
          layout={{
            height: 360,
            margin: { l: 50, r: 20, t: 20, b: 50 },
            xaxis: { title: "Date" },
            yaxis: { title: featureKey },
          }}
          config={{ displayModeBar: false }}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}


