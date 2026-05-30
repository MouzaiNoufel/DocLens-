import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  FileText, Upload, ChevronLeft, AlertTriangle, CheckCircle, Pencil,
  Save, X, RotateCcw, ArrowRight, Eye, Zap, Shield, Loader, Wifi, WifiOff,
} from "lucide-react";
import { api } from "./api";
import Analytics from "./Analytics";

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

const STATUS = {
  processing: { label: "Processing", color: T.blue, bg: T.blueBg, Icon: Loader, spin: true },
  auto_approved: { label: "Auto-approved", color: T.green, bg: T.greenBg, Icon: CheckCircle },
  needs_review: { label: "Needs review", color: T.amber, bg: T.amberBg, Icon: Eye },
  reviewed: { label: "Reviewed", color: T.blue, bg: T.blueBg, Icon: Shield },
};

const confColor = (c) => c >= 0.85 ? T.green : c >= 0.55 ? T.amber : T.red;
const confBg = (c) => c >= 0.85 ? T.greenBg : c >= 0.55 ? T.amberBg : T.redBg;
const fmtCurrency = (v, cur = "USD") =>
  v != null && !isNaN(v)
    ? `${cur === "EUR" ? "€" : "$"}${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
};

// ── Sub-components ────────────────────────────────────────────────
const Badge = ({ status }) => {
  const s = STATUS[status] || STATUS.processing;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
      padding: "3px 10px", borderRadius: 6, color: s.color, background: s.bg, letterSpacing: "0.02em",
    }}>
      <s.Icon size={12} style={s.spin ? { animation: "spin 1s linear infinite" } : undefined} />
      {s.label}
    </span>
  );
};

const ConfBar = ({ value, width = 80, height = 5 }) => (
  <div style={{ width, height, borderRadius: height, background: T.border, overflow: "hidden", flexShrink: 0 }}>
    <div style={{
      width: `${Math.round((value || 0) * 100)}%`, height: "100%", borderRadius: height,
      background: confColor(value || 0), transition: "width 0.6s ease",
    }} />
  </div>
);

const ConnectionDot = ({ online }) => (
  <div title={online ? "Connected to API" : "API unreachable"} style={{
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

// ── Main app ──────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("queue");
  const [docs, setDocs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState("all");
  const [editField, setEditField] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [uploading, setUploading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [online, setOnline] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const fileInputRef = useRef(null);
  const docsRef = useRef(docs);
  const detailRef = useRef(detail);
  docsRef.current = docs;
  detailRef.current = detail;

  // ── Fetchers ──
  const refreshList = useCallback(async () => {
    try {
      const list = await api.listDocuments();
      setDocs(list);
      setOnline(true);
      return list;
    } catch (e) {
      setOnline(false);
      setError(`Failed to load documents: ${e.message}`);
      return null;
    }
  }, []);

  const refreshDetail = useCallback(async (id) => {
    try {
      const d = await api.getDocument(id);
      setDetail(d);
      setOnline(true);
      return d;
    } catch (e) {
      setOnline(false);
      setError(`Failed to load document: ${e.message}`);
      return null;
    }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      await refreshList();
      setInitialLoading(false);
    })();
  }, [refreshList]);

  // Poll the list every 3s while any document is processing
  useEffect(() => {
    const id = setInterval(() => {
      if (docsRef.current.some((d) => d.status === "processing")) {
        refreshList();
      }
    }, 3000);
    return () => clearInterval(id);
  }, [refreshList]);

  // When a document is selected, fetch its detail and poll while processing
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    refreshDetail(selectedId);
    const id = setInterval(() => {
      if (detailRef.current?.status === "processing") {
        refreshDetail(selectedId);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [selectedId, refreshDetail]);

  // ── Handlers ──
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow re-uploading same file
    setUploading(true);
    setError(null);
    try {
      await api.uploadDocument(file);
      await refreshList();
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (id) => {
    setBusyAction(true);
    setError(null);
    try {
      await api.approveDocument(id);
      await refreshList();
      await refreshDetail(id);
    } catch (err) {
      setError(`Approve failed: ${err.message}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleReject = async (id) => {
    setBusyAction(true);
    setError(null);
    try {
      await api.rejectDocument(id);
      await refreshList();
      await refreshDetail(id);
    } catch (err) {
      setError(`Reject failed: ${err.message}`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleFieldSave = async (docId, fieldName) => {
    setBusyAction(true);
    setError(null);
    try {
      await api.updateField(docId, fieldName, editVal);
      await refreshDetail(docId);
    } catch (err) {
      setError(`Correction failed: ${err.message}`);
    } finally {
      setEditField(null);
      setBusyAction(false);
    }
  };

  // ── Derived ──
  const filtered = useMemo(
    () => docs.filter((d) => filter === "all" || d.status === filter),
    [docs, filter]
  );

  const counts = useMemo(() => ({
    all: docs.length,
    processing: docs.filter((d) => d.status === "processing").length,
    auto_approved: docs.filter((d) => d.status === "auto_approved").length,
    needs_review: docs.filter((d) => d.status === "needs_review").length,
    reviewed: docs.filter((d) => d.status === "reviewed").length,
  }), [docs]);

  const fieldsMap = useMemo(
    () => Object.fromEntries((detail?.fields || []).map((f) => [f.field_name, f])),
    [detail]
  );

  // ── Renderers ──
  const renderList = () => (
    <div style={{ padding: "24px 20px 20px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
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
              background: view === t.k ? T.surfaceActive : "transparent",
              color: view === t.k ? T.text : T.textTer,
              transition: "all 0.15s",
            }}>{t.l}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <ConnectionDot online={online} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total", value: counts.all, color: T.textSec },
          { label: "Approved", value: counts.auto_approved, color: T.green },
          { label: "Review", value: counts.needs_review, color: T.amber },
          { label: "Done", value: counts.reviewed, color: T.blue },
        ].map((s) => (
          <div key={s.label} style={{
            background: T.surface, borderRadius: 10, padding: "12px 14px",
            border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.textTer, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Upload */}
      <input
        ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.bmp"
        onChange={handleFileChange} style={{ display: "none" }}
      />
      <button
        onClick={handleUploadClick} disabled={uploading}
        style={{
          width: "100%", padding: "16px", borderRadius: 10,
          border: `1.5px dashed ${uploading ? T.accent : T.borderLight}`,
          background: uploading ? T.accentBg : "transparent",
          color: uploading ? T.accent : T.textTer, cursor: uploading ? "wait" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontSize: 13, fontWeight: 500, marginBottom: 20, transition: "all 0.2s",
        }}
        onMouseEnter={(e) => { if (!uploading) { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}}
        onMouseLeave={(e) => { if (!uploading) { e.currentTarget.style.borderColor = T.borderLight; e.currentTarget.style.color = T.textTer; }}}
      >
        {uploading ? <Loader size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={15} />}
        {uploading ? "Uploading..." : "Click to upload an invoice (PDF or image)"}
      </button>

      {/* Filters */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "all", label: "All" },
          { key: "needs_review", label: "Review" },
          { key: "auto_approved", label: "Approved" },
          { key: "reviewed", label: "Done" },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600,
            background: filter === f.key ? T.surfaceActive : "transparent",
            color: filter === f.key ? T.text : T.textTer, transition: "all 0.15s",
          }}>
            {f.label}
            <span style={{
              marginLeft: 5, fontSize: 10, padding: "1px 6px", borderRadius: 5,
              background: filter === f.key ? T.border : "transparent",
              color: filter === f.key ? T.textSec : T.textTer,
            }}>{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: T.textTer, fontSize: 13 }}>
            {docs.length === 0 ? "No documents yet. Upload an invoice to get started." : "No documents match this filter."}
          </div>
        )}
        {filtered.map((doc) => {
          const st = STATUS[doc.status] || STATUS.processing;
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedId(doc.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "14px 16px", borderRadius: 10, border: `1px solid ${T.border}`,
                background: T.surface, cursor: "pointer", textAlign: "left",
                transition: "all 0.15s", borderLeft: `3px solid ${st.color}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.surfaceHover; e.currentTarget.style.borderColor = T.borderLight; e.currentTarget.style.borderLeftColor = st.color; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.surface; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.borderLeftColor = st.color; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: T.surfaceActive,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <FileText size={16} color={T.textTer} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: T.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 250,
                  }}>{doc.vendor_name || doc.filename}</span>
                  <Badge status={doc.status} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: T.textTer, flexWrap: "wrap" }}>
                  {doc.invoice_number && <><span>{doc.invoice_number}</span><span>·</span></>}
                  {doc.total != null && <><span style={{ fontWeight: 600, color: T.textSec }}>{fmtCurrency(doc.total)}</span><span>·</span></>}
                  <span>{fmtDate(doc.created_at)}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {doc.status !== "processing" && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: confColor(doc.overall_confidence) }}>
                      {Math.round(doc.overall_confidence * 100)}%
                    </div>
                    <ConfBar value={doc.overall_confidence} width={56} height={4} />
                  </div>
                )}
                <ArrowRight size={14} color={T.textTer} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDetail = () => {
    if (!detail) {
      return (
        <div style={{ padding: 60, textAlign: "center" }}>
          <Loader size={20} color={T.textTer} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      );
    }

    return (
      <div style={{ padding: "24px 20px 20px", maxWidth: 900, margin: "0 auto" }}>
        <button onClick={() => { setSelectedId(null); setEditField(null); }} style={{
          display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
          color: T.textSec, cursor: "pointer", fontSize: 12, fontWeight: 500,
          padding: 0, marginBottom: 20,
        }}>
          <ChevronLeft size={14} /> Back to queue
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
              {fieldsMap.vendor_name?.value || "Unknown vendor"}
            </div>
            <div style={{ fontSize: 12, color: T.textTer }}>
              {detail.filename} · {detail.page_count} page(s) · uploaded {fmtDate(detail.created_at)}
            </div>
          </div>
          <Badge status={detail.status} />
        </div>

        {detail.status === "processing" ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px",
            background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
          }}>
            <Loader size={32} color={T.blue} style={{ animation: "spin 1s linear infinite", marginBottom: 16 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Extracting fields...</div>
            <div style={{ fontSize: 12, color: T.textTer, textAlign: "center" }}>
              The VLM is reading the document. This takes 5–15s per page (longer on first run while the model loads).
            </div>
          </div>
        ) : (
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
              background: confBg(detail.overall_confidence), borderRadius: 10, marginBottom: 20,
              border: `1px solid ${confColor(detail.overall_confidence)}22`,
            }}>
              <div style={{
                fontSize: 28, fontWeight: 700, color: confColor(detail.overall_confidence), letterSpacing: "-0.03em",
              }}>{Math.round(detail.overall_confidence * 100)}%</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Overall confidence</div>
                <div style={{ fontSize: 11, color: T.textSec }}>
                  {detail.overall_confidence >= 0.85 ? "All fields look good"
                    : detail.overall_confidence >= 0.55 ? "Some fields need verification"
                    : "Multiple fields have low confidence"}
                </div>
              </div>
            </div>

            {detail.flags?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {detail.flags.map((flag) => (
                  <span key={flag} style={{
                    display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                    padding: "4px 10px", borderRadius: 6, color: T.red, background: T.redBg,
                  }}>
                    <AlertTriangle size={11} />{flag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}

            <div style={{
              fontSize: 11, fontWeight: 600, color: T.textTer,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
            }}>Extracted fields</div>

            <div style={{
              border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 20,
            }}>
              {(detail.fields || []).map((field, i, arr) => {
                const isEditing = editField === field.field_name;
                const displayValue = field.corrected_value ?? field.value;
                const isCorrected = field.corrected_value != null;
                const label = FIELD_LABELS[field.field_name] || field.field_name;
                return (
                  <div key={field.field_name} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px",
                    borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
                    background: isEditing ? T.surfaceActive : field.confidence < 0.55 ? T.redBg : "transparent",
                    transition: "background 0.15s",
                  }}>
                    <div style={{ width: 110, fontSize: 11, color: T.textTer, fontWeight: 500, flexShrink: 0 }}>{label}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            autoFocus value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleFieldSave(detail.id, field.field_name);
                              if (e.key === "Escape") setEditField(null);
                            }}
                            style={{
                              flex: 1, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.accent}`,
                              background: T.surface, color: T.text, fontSize: 13,
                            }}
                          />
                          <button onClick={() => handleFieldSave(detail.id, field.field_name)} disabled={busyAction}
                            style={{
                              background: T.accentBg, border: "none", borderRadius: 6, padding: "4px 8px",
                              cursor: busyAction ? "wait" : "pointer", display: "flex", alignItems: "center",
                            }}><Save size={13} color={T.accent} /></button>
                          <button onClick={() => setEditField(null)} style={{
                            background: T.surfaceActive, border: "none", borderRadius: 6, padding: "4px 8px",
                            cursor: "pointer", display: "flex", alignItems: "center",
                          }}><X size={13} color={T.textTer} /></button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontSize: 13, fontWeight: 500,
                            color: displayValue != null && displayValue !== "" && displayValue !== "None" ? T.text : T.red,
                          }}>
                            {displayValue != null && displayValue !== "" && displayValue !== "None" ? displayValue : "missing"}
                          </span>
                          {isCorrected && (
                            <span style={{
                              fontSize: 9, fontWeight: 600, color: T.accent, background: T.accentBg,
                              padding: "1px 6px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase",
                            }}>corrected</span>
                          )}
                          {detail.status === "needs_review" && (
                            <button onClick={() => { setEditField(field.field_name); setEditVal(displayValue ?? ""); }}
                              style={{
                                background: "none", border: "none", cursor: "pointer", padding: 2,
                                opacity: 0.4, transition: "opacity 0.15s",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = 0.4}
                            ><Pencil size={11} color={T.textSec} /></button>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: confColor(field.confidence),
                        minWidth: 28, textAlign: "right",
                      }}>{Math.round(field.confidence * 100)}</span>
                      <ConfBar value={field.confidence} width={48} height={4} />
                    </div>
                  </div>
                );
              })}
            </div>

            {detail.line_items?.length > 0 && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: T.textTer,
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
                }}>Line items</div>
                <div style={{
                  border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 24,
                }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 50px 80px 80px",
                    padding: "8px 14px", background: T.surfaceActive, fontSize: 10,
                    fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    <span>Description</span>
                    <span style={{ textAlign: "right" }}>Qty</span>
                    <span style={{ textAlign: "right" }}>Price</span>
                    <span style={{ textAlign: "right" }}>Amount</span>
                  </div>
                  {detail.line_items.map((li, i) => (
                    <div key={i} style={{
                      display: "grid", gridTemplateColumns: "1fr 50px 80px 80px",
                      padding: "10px 14px", borderTop: `1px solid ${T.border}`,
                      fontSize: 12, color: T.textSec,
                    }}>
                      <span style={{ color: T.text, fontWeight: 500 }}>{li.description ?? "—"}</span>
                      <span style={{ textAlign: "right" }}>{li.quantity ?? "—"}</span>
                      <span style={{ textAlign: "right" }}>{fmtCurrency(li.unit_price)}</span>
                      <span style={{ textAlign: "right", fontWeight: 600, color: T.text }}>{fmtCurrency(li.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              {detail.status === "needs_review" && (
                <button onClick={() => handleApprove(detail.id)} disabled={busyAction}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 10, border: "none",
                    background: T.green, color: "#064E3B", fontSize: 13, fontWeight: 700,
                    cursor: busyAction ? "wait" : "pointer", opacity: busyAction ? 0.6 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "opacity 0.15s",
                  }}><CheckCircle size={15} /> Approve extraction</button>
              )}
              {detail.status === "reviewed" && (
                <button onClick={() => handleReject(detail.id)} disabled={busyAction}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${T.border}`,
                    background: T.surface, color: T.textSec, fontSize: 13, fontWeight: 600,
                    cursor: busyAction ? "wait" : "pointer", opacity: busyAction ? 0.6 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}><RotateCcw size={14} /> Send back to review</button>
              )}
              {detail.status === "auto_approved" && (
                <div style={{
                  flex: 1, padding: "12px", borderRadius: 10, background: T.greenBg,
                  color: T.green, fontSize: 13, fontWeight: 600, textAlign: "center",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}><CheckCircle size={15} /> Auto-approved — no action needed</div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {error && (
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: T.redBg, borderBottom: `1px solid ${T.red}33`,
          padding: "10px 20px", color: T.red, fontSize: 12, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{
            background: "none", border: "none", cursor: "pointer", color: T.red,
            display: "flex", alignItems: "center",
          }}><X size={14} /></button>
        </div>
      )}
      {initialLoading ? (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 12,
        }}>
          <Loader size={24} color={T.accent} style={{ animation: "spin 1s linear infinite" }} />
          <div style={{ fontSize: 12, color: T.textTer }}>Connecting to DocLens API...</div>
        </div>
      ) : view === "analytics" ? (
        <Analytics setView={setView} online={online} setError={setError} />
      ) : selectedId ? renderDetail() : renderList()}
    </>
  );
}
