import { useState, useEffect } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Zap, Loader, TrendingUp, AlertTriangle } from "lucide-react";
import { api } from "./api";

const T = {
  bg: "#0B0B0F", surface: "#141418", surfaceHover: "#1A1A1F",
  surfaceActive: "#222228", border: "#26262C", borderLight: "#35353D",
  text: "#F0F0F2", textSec: "#9B9BA6", textTer: "#5C5C66",
  accent: "#E8A230", accentBg: "rgba(232,162,48,0.10)",
  green: "#34D399", greenBg: "rgba(52,211,153,0.10)",
  amber: "#FBBF24", amberBg: "rgba(251,191,36,0.10)",
  red: "#F87171", redBg: "rgba(248,113,113,0.10)",
  blue: "#60A5FA", blueBg: "rgba(96,165,250,0.10)",
};

const FIELD_LABELS = {
  vendor_name: "Vendor name", vendor_address: "Vendor address",
  invoice_number: "Invoice number", invoice_date: "Invoice date",
  due_date: "Due date", currency: "Currency",
  subtotal: "Subtotal", tax: "Tax", total: "Total",
};

const STATUS_COLORS = {
  auto_approved: T.green, needs_review: T.amber,
  reviewed: T.blue, processing: T.blue,
};

const CONF_COLORS = [T.red, T.red, T.amber, T.amber, T.green];

const fmtPct = (n) => `${Math.round((n || 0) * 100)}%`;

const TooltipStyle = {
  background: T.surface,
  border: `1px solid ${T.borderLight}`,
  borderRadius: 8,
  fontSize: 12,
  color: T.text,
  padding: "8px 10px",
};

// ── Sub-components ─────────────────────────────────────────────────
const ConnectionDot = ({ online }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6,
    background: online ? T.greenBg : T.redBg, color: online ? T.green : T.red, fontSize: 11, fontWeight: 600,
  }}>
    <div style={{
      width: 6, height: 6, borderRadius: 3,
      background: online ? T.green : T.red,
      animation: online ? "pulse 2s ease-in-out infinite" : "none",
    }} />
    {online ? "Live" : "Offline"}
  </div>
);

const Card = ({ children, style }) => (
  <div style={{
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
    padding: 18, ...style,
  }}>{children}</div>
);

const KPI = ({ label, value, sub, color = T.text }) => (
  <Card>
    <div style={{ fontSize: 11, color: T.textTer, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
      {label}
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.textTer, marginTop: 6 }}>{sub}</div>}
  </Card>
);

const SectionTitle = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 600, color: T.textTer,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
  }}>{children}</div>
);

// ── Main ───────────────────────────────────────────────────────────
export default function Analytics({ setView, online, setError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const a = await api.getAnalytics();
        if (active) setData(a);
      } catch (e) {
        if (active) setError?.(`Failed to load analytics: ${e.message}`);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [setError]);

  if (loading || !data) {
    return (
      <div style={{
        minHeight: "60vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 12,
      }}>
        <Loader size={24} color={T.accent} style={{ animation: "spin 1s linear infinite" }} />
        <div style={{ fontSize: 12, color: T.textTer }}>Loading analytics...</div>
      </div>
    );
  }

  const { summary, throughput, confidence_distribution, field_accuracy, top_flags } = data;

  // Status breakdown for pie chart
  const statusBreakdown = [
    { name: "Auto-approved", value: summary.auto_approved, color: T.green },
    { name: "Needs review", value: summary.needs_review, color: T.amber },
    { name: "Reviewed", value: summary.reviewed, color: T.blue },
    { name: "Processing", value: summary.processing, color: T.textTer },
  ].filter((s) => s.value > 0);

  const hasData = summary.total_documents > 0;

  return (
    <div style={{ padding: "24px 20px 20px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: T.accentBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Zap size={16} color={T.accent} />
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>DocLens</span>
        <div style={{
          display: "flex", gap: 2, marginLeft: 16, padding: 2,
          background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`,
        }}>
          {[{ k: "queue", l: "Queue" }, { k: "analytics", l: "Analytics" }].map((t) => (
            <button key={t.k} onClick={() => setView(t.k)} style={{
              padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600,
              background: t.k === "analytics" ? T.surfaceActive : "transparent",
              color: t.k === "analytics" ? T.text : T.textTer,
              transition: "all 0.15s",
            }}>{t.l}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <ConnectionDot online={online} />
        </div>
      </div>

      {!hasData ? (
        <div style={{
          padding: 60, textAlign: "center", background: T.surface,
          borderRadius: 10, border: `1px solid ${T.border}`,
        }}>
          <TrendingUp size={32} color={T.textTer} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
            No data yet
          </div>
          <div style={{ fontSize: 12, color: T.textTer }}>
            Upload a few invoices from the Queue tab to see analytics here.
          </div>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12, marginBottom: 20,
          }}>
            <KPI
              label="Total documents"
              value={summary.total_documents}
              sub={`${summary.processing} currently processing`}
            />
            <KPI
              label="Auto-approve rate"
              value={fmtPct(summary.auto_approve_rate)}
              color={summary.auto_approve_rate >= 0.7 ? T.green : summary.auto_approve_rate >= 0.4 ? T.amber : T.red}
              sub={`${summary.auto_approved} of ${summary.total_documents - summary.processing} decided`}
            />
            <KPI
              label="Correction rate"
              value={fmtPct(summary.correction_rate)}
              color={summary.correction_rate <= 0.15 ? T.green : summary.correction_rate <= 0.35 ? T.amber : T.red}
              sub="of documents had ≥ 1 field corrected"
            />
            <KPI
              label="Avg confidence"
              value={fmtPct(summary.avg_confidence)}
              color={summary.avg_confidence >= 0.85 ? T.green : summary.avg_confidence >= 0.55 ? T.amber : T.red}
              sub="across all extracted documents"
            />
          </div>

          {/* Throughput */}
          <Card style={{ marginBottom: 20 }}>
            <SectionTitle>Throughput · last 14 days</SectionTitle>
            <div style={{ width: "100%", height: 200 }}>
              {throughput.length === 0 ? (
                <div style={{
                  height: "100%", display: "flex", alignItems: "center",
                  justifyContent: "center", color: T.textTer, fontSize: 12,
                }}>No documents in the last 14 days.</div>
              ) : (
                <ResponsiveContainer>
                  <AreaChart data={throughput} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={T.accent} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={T.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis dataKey="date" stroke={T.textTer} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={T.textTer} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TooltipStyle} cursor={{ stroke: T.borderLight }} />
                    <Area type="monotone" dataKey="count" stroke={T.accent} strokeWidth={2} fill="url(#throughputFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Confidence distribution + Status breakdown */}
          <div style={{
            display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 20,
          }}>
            <Card>
              <SectionTitle>Confidence distribution</SectionTitle>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={confidence_distribution} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis dataKey="bucket" stroke={T.textTer} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={T.textTer} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TooltipStyle} cursor={{ fill: T.surfaceHover }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {confidence_distribution.map((_, i) => (
                        <Cell key={i} fill={CONF_COLORS[i] || T.green} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <SectionTitle>Status breakdown</SectionTitle>
              <div style={{ width: "100%", height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusBreakdown} dataKey="value" nameKey="name"
                      innerRadius={45} outerRadius={75} paddingAngle={2}
                      stroke="none"
                    >
                      {statusBreakdown.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                {statusBreakdown.map((s) => (
                  <div key={s.name} style={{
                    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textSec,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                    {s.name} · <span style={{ color: T.text, fontWeight: 600 }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Field accuracy */}
          <Card style={{ marginBottom: 20 }}>
            <SectionTitle>Field accuracy · worst-performing first</SectionTitle>
            {field_accuracy.length === 0 ? (
              <div style={{ color: T.textTer, fontSize: 12, padding: 20, textAlign: "center" }}>
                No field data yet — extractions will populate this.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {field_accuracy.slice(0, 10).map((f) => (
                  <div key={f.field_name} style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr 60px 80px",
                    alignItems: "center", gap: 12,
                  }}>
                    <div style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>
                      {FIELD_LABELS[f.field_name] || f.field_name}
                    </div>
                    <div style={{
                      height: 6, background: T.border, borderRadius: 3, overflow: "hidden",
                    }}>
                      <div style={{
                        width: `${Math.round(f.accuracy * 100)}%`, height: "100%",
                        background: f.accuracy >= 0.9 ? T.green : f.accuracy >= 0.7 ? T.amber : T.red,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                    <div style={{
                      fontSize: 12, fontWeight: 700, textAlign: "right",
                      color: f.accuracy >= 0.9 ? T.green : f.accuracy >= 0.7 ? T.amber : T.red,
                    }}>{fmtPct(f.accuracy)}</div>
                    <div style={{ fontSize: 11, color: T.textTer, textAlign: "right" }}>
                      {f.corrected}/{f.total} fixed
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Top flags */}
          {top_flags.length > 0 && (
            <Card>
              <SectionTitle>Most common validation flags</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {top_flags.map((f) => {
                  const maxCount = top_flags[0].count;
                  return (
                    <div key={f.flag} style={{
                      display: "grid",
                      gridTemplateColumns: "200px 1fr 40px",
                      alignItems: "center", gap: 12,
                    }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 12, color: T.text, fontWeight: 500,
                      }}>
                        <AlertTriangle size={11} color={T.red} />
                        {f.flag.replace(/_/g, " ")}
                      </div>
                      <div style={{
                        height: 6, background: T.border, borderRadius: 3, overflow: "hidden",
                      }}>
                        <div style={{
                          width: `${(f.count / maxCount) * 100}%`, height: "100%",
                          background: T.red, transition: "width 0.6s ease",
                        }} />
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: 700, color: T.text, textAlign: "right",
                      }}>{f.count}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
