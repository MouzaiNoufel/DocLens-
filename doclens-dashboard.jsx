import { useState, useEffect } from "react";
import { FileText, Upload, ChevronLeft, AlertTriangle, CheckCircle, Clock, Pencil, Save, X, RotateCcw, ArrowRight, Eye, Zap, Shield } from "lucide-react";

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

const confColor = (c) => c >= 0.85 ? T.green : c >= 0.55 ? T.amber : T.red;
const confBg = (c) => c >= 0.85 ? T.greenBg : c >= 0.55 ? T.amberBg : T.redBg;
const fmtCurrency = (v, cur = "USD") => v != null ? `${cur === "EUR" ? "€" : "$"}${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

const STATUS = {
  auto_approved: { label: "Auto-approved", color: T.green, bg: T.greenBg, Icon: CheckCircle },
  needs_review: { label: "Needs review", color: T.amber, bg: T.amberBg, Icon: Eye },
  reviewed: { label: "Reviewed", color: T.blue, bg: T.blueBg, Icon: Shield },
};

const INITIAL_DOCS = [
  {
    id: "d1", filename: "acme_supplies_march.pdf", uploadedAt: "Mar 14 · 10:23 AM",
    status: "needs_review", overallConfidence: 0.72, flags: ["totals_mismatch"], pageCount: 1,
    fields: {
      vendor_name: { value: "Acme Supplies Ltd", confidence: 0.93 },
      vendor_address: { value: "742 Industrial Blvd, Chicago IL", confidence: 0.85 },
      invoice_number: { value: "INV-2024-0342", confidence: 0.97 },
      invoice_date: { value: "2024-03-14", confidence: 0.91 },
      due_date: { value: "2024-04-14", confidence: 0.88 },
      currency: { value: "USD", confidence: 0.99 },
      subtotal: { value: 1200.00, confidence: 0.82 },
      tax: { value: 108.00, confidence: 0.78 },
      total: { value: 1296.00, confidence: 0.45 },
    },
    lineItems: [
      { desc: "Widget A — Premium", qty: 10, price: 80, amount: 800 },
      { desc: "Widget B — Standard", qty: 5, price: 80, amount: 400 },
    ],
  },
  {
    id: "d2", filename: "techcorp_q1_services.pdf", uploadedAt: "Mar 13 · 3:45 PM",
    status: "auto_approved", overallConfidence: 0.96, flags: [], pageCount: 1,
    fields: {
      vendor_name: { value: "TechCorp Inc", confidence: 0.98 },
      vendor_address: { value: "1200 Tech Park Dr, Austin TX", confidence: 0.95 },
      invoice_number: { value: "TC-8891", confidence: 0.99 },
      invoice_date: { value: "2024-03-01", confidence: 0.97 },
      due_date: { value: "2024-03-31", confidence: 0.94 },
      currency: { value: "USD", confidence: 0.99 },
      subtotal: { value: 4200.00, confidence: 0.96 },
      tax: { value: 300.00, confidence: 0.95 },
      total: { value: 4500.00, confidence: 0.98 },
    },
    lineItems: [
      { desc: "Cloud hosting — March", qty: 1, price: 2500, amount: 2500 },
      { desc: "Support contract", qty: 1, price: 1700, amount: 1700 },
    ],
  },
  {
    id: "d3", filename: "global_logistics_feb.pdf", uploadedAt: "Mar 12 · 9:10 AM",
    status: "auto_approved", overallConfidence: 0.91, flags: [], pageCount: 2,
    fields: {
      vendor_name: { value: "Global Logistics Co", confidence: 0.94 },
      vendor_address: { value: "88 Harbor Way, Long Beach CA", confidence: 0.89 },
      invoice_number: { value: "GL-2024-156", confidence: 0.97 },
      invoice_date: { value: "2024-02-28", confidence: 0.93 },
      due_date: { value: "2024-03-28", confidence: 0.90 },
      currency: { value: "USD", confidence: 0.99 },
      subtotal: { value: 830.00, confidence: 0.92 },
      tax: { value: 62.50, confidence: 0.88 },
      total: { value: 892.50, confidence: 0.94 },
    },
    lineItems: [
      { desc: "Freight — container #4412", qty: 1, price: 680, amount: 680 },
      { desc: "Customs clearance", qty: 1, price: 150, amount: 150 },
    ],
  },
  {
    id: "d4", filename: "smith_partners_legal.pdf", uploadedAt: "Mar 11 · 2:00 PM",
    status: "needs_review", overallConfidence: 0.48, flags: ["missing_due_date", "line_items_sum_mismatch"], pageCount: 1,
    fields: {
      vendor_name: { value: "Smith & Partners LLP", confidence: 0.88 },
      vendor_address: { value: "55 Court St, Boston MA", confidence: 0.72 },
      invoice_number: { value: "SP-0044", confidence: 0.91 },
      invoice_date: { value: "2024-03-10", confidence: 0.85 },
      due_date: { value: null, confidence: 0.0 },
      currency: { value: "USD", confidence: 0.95 },
      subtotal: { value: 2100.00, confidence: 0.60 },
      tax: { value: 240.00, confidence: 0.55 },
      total: { value: 2340.00, confidence: 0.48 },
    },
    lineItems: [
      { desc: "Legal consultation — 6h", qty: 6, price: 300, amount: 1800 },
      { desc: "Court filing fees", qty: 1, price: 450, amount: 450 },
    ],
  },
  {
    id: "d5", filename: "metro_office_supplies.pdf", uploadedAt: "Mar 10 · 11:30 AM",
    status: "reviewed", overallConfidence: 0.92, flags: [], pageCount: 1,
    fields: {
      vendor_name: { value: "Metro Office Supply", confidence: 0.95 },
      vendor_address: { value: "320 Commerce Rd, Newark NJ", confidence: 0.90 },
      invoice_number: { value: "MOS-7721", confidence: 0.97 },
      invoice_date: { value: "2024-03-08", confidence: 0.93 },
      due_date: { value: "2024-04-08", confidence: 0.91 },
      currency: { value: "USD", confidence: 0.99 },
      subtotal: { value: 142.00, confidence: 0.94 },
      tax: { value: 14.80, confidence: 0.90 },
      total: { value: 156.80, confidence: 0.96 },
    },
    lineItems: [
      { desc: "Copy paper, A4 (10 reams)", qty: 10, price: 8.50, amount: 85 },
      { desc: "Toner cartridge — HP 26A", qty: 1, price: 57, amount: 57 },
    ],
  },
  {
    id: "d6", filename: "dataserv_q1_scan.jpg", uploadedAt: "Mar 9 · 4:55 PM",
    status: "needs_review", overallConfidence: 0.34, flags: ["totals_mismatch", "unparseable_due_date"], pageCount: 1,
    fields: {
      vendor_name: { value: "DataServ Solutions", confidence: 0.68 },
      vendor_address: { value: "?? Tech Center, Denver", confidence: 0.31 },
      invoice_number: { value: "DS-2024-Q1", confidence: 0.72 },
      invoice_date: { value: "2024-01-15", confidence: 0.60 },
      due_date: { value: "02/??/2024", confidence: 0.15 },
      currency: { value: "USD", confidence: 0.82 },
      subtotal: { value: 11800.00, confidence: 0.40 },
      tax: { value: 950.00, confidence: 0.35 },
      total: { value: 12750.00, confidence: 0.28 },
    },
    lineItems: [
      { desc: "Data migration — Phase 1", qty: 1, price: 8500, amount: 8500 },
      { desc: "API integration setup", qty: 1, price: 3300, amount: 3300 },
    ],
  },
];

const Badge = ({ status }) => {
  const s = STATUS[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
      padding: "3px 10px", borderRadius: 6, color: s.color, background: s.bg,
      letterSpacing: "0.02em",
    }}>
      <s.Icon size={12} /> {s.label}
    </span>
  );
};

const ConfBar = ({ value, width = 80, height = 5 }) => (
  <div style={{ width, height, borderRadius: height, background: T.border, overflow: "hidden", flexShrink: 0 }}>
    <div style={{
      width: `${Math.round(value * 100)}%`, height: "100%", borderRadius: height,
      background: confColor(value), transition: "width 0.6s ease",
    }} />
  </div>
);

export default function DocLensDashboard() {
  const [docs, setDocs] = useState(INITIAL_DOCS);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [editField, setEditField] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const selected = docs.find((d) => d.id === selectedId);
  const filtered = docs.filter((d) => filter === "all" || d.status === filter);
  const counts = {
    all: docs.length,
    auto_approved: docs.filter((d) => d.status === "auto_approved").length,
    needs_review: docs.filter((d) => d.status === "needs_review").length,
    reviewed: docs.filter((d) => d.status === "reviewed").length,
  };

  const handleApprove = (id) => {
    setDocs((prev) => prev.map((d) => d.id === id ? { ...d, status: "reviewed", flags: [] } : d));
    setSelectedId(null);
  };

  const handleSendBack = (id) => {
    setDocs((prev) => prev.map((d) => d.id === id ? { ...d, status: "needs_review" } : d));
  };

  const handleFieldSave = (docId, fieldKey) => {
    setDocs((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const f = { ...d.fields };
        f[fieldKey] = { ...f[fieldKey], value: editVal, confidence: Math.min(1, f[fieldKey].confidence + 0.15) };
        const newConf = Object.values(f).reduce((s, v) => s + v.confidence, 0) / Object.keys(f).length;
        return { ...d, fields: f, overallConfidence: Math.round(newConf * 100) / 100 };
      })
    );
    setEditField(null);
  };

  const simulateUpload = () => {
    setUploading(true);
    setTimeout(() => {
      const newDoc = {
        id: "d_" + Date.now(), filename: "new_invoice_upload.pdf",
        uploadedAt: "Just now", status: "needs_review",
        overallConfidence: 0.63, flags: ["line_items_sum_mismatch"], pageCount: 1,
        fields: {
          vendor_name: { value: "NewVendor Corp", confidence: 0.80 },
          vendor_address: { value: "100 Main St, New York NY", confidence: 0.70 },
          invoice_number: { value: "NV-" + Math.floor(Math.random() * 9999), confidence: 0.88 },
          invoice_date: { value: "2024-03-15", confidence: 0.85 },
          due_date: { value: "2024-04-15", confidence: 0.78 },
          currency: { value: "USD", confidence: 0.95 },
          subtotal: { value: 750.00, confidence: 0.65 },
          tax: { value: 60.00, confidence: 0.60 },
          total: { value: 810.00, confidence: 0.63 },
        },
        lineItems: [{ desc: "Consulting services", qty: 5, price: 150, amount: 750 }],
      };
      setDocs((prev) => [newDoc, ...prev]);
      setUploading(false);
    }, 1500);
  };

  const root = {
    fontFamily: "'DM Sans', system-ui, sans-serif", background: T.bg, color: T.text,
    minHeight: "100vh", padding: "0", boxSizing: "border-box",
  };

  // ── LIST VIEW ──
  const renderList = () => (
    <div style={{ padding: "24px 20px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: T.accentBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Zap size={16} color={T.accent} />
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>DocLens</span>
        <span style={{ fontSize: 12, color: T.textTer, marginLeft: 4, fontWeight: 500 }}>review queue</span>
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
      <button
        onClick={simulateUpload}
        disabled={uploading}
        style={{
          width: "100%", padding: "16px", borderRadius: 10,
          border: `1.5px dashed ${uploading ? T.accent : T.borderLight}`,
          background: uploading ? T.accentBg : "transparent",
          color: uploading ? T.accent : T.textTer, cursor: uploading ? "wait" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontSize: 13, fontWeight: 500, marginBottom: 20, transition: "all 0.2s",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => { if (!uploading) { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}}
        onMouseLeave={(e) => { if (!uploading) { e.currentTarget.style.borderColor = T.borderLight; e.currentTarget.style.color = T.textTer; }}}
      >
        <Upload size={15} />
        {uploading ? "Processing invoice..." : "Drop an invoice or click to upload"}
      </button>

      {/* Filters */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[
          { key: "all", label: "All" },
          { key: "needs_review", label: "Review" },
          { key: "auto_approved", label: "Approved" },
          { key: "reviewed", label: "Done" },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            background: filter === f.key ? T.surfaceActive : "transparent",
            color: filter === f.key ? T.text : T.textTer,
            transition: "all 0.15s",
          }}>
            {f.label}
            <span style={{
              marginLeft: 5, fontSize: 10, padding: "1px 6px", borderRadius: 5,
              background: filter === f.key ? T.border : "transparent",
              color: filter === f.key ? T.textSec : T.textTer,
            }}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Document list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: T.textTer, fontSize: 13 }}>
            No documents in this view.
          </div>
        )}
        {filtered.map((doc) => {
          const st = STATUS[doc.status];
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedId(doc.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "14px 16px", borderRadius: 10, border: `1px solid ${T.border}`,
                background: T.surface, cursor: "pointer", textAlign: "left",
                transition: "all 0.15s", fontFamily: "inherit",
                borderLeft: `3px solid ${st.color}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.surfaceHover; e.currentTarget.style.borderColor = T.borderLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.surface; e.currentTarget.style.borderColor = T.border; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: T.surfaceActive,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <FileText size={16} color={T.textTer} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.fields.vendor_name.value || doc.filename}
                  </span>
                  <Badge status={doc.status} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: T.textTer }}>
                  <span>{doc.fields.invoice_number.value}</span>
                  <span>·</span>
                  <span style={{ fontWeight: 600, color: T.textSec }}>{fmtCurrency(doc.fields.total.value, doc.fields.currency?.value)}</span>
                  <span>·</span>
                  <span>{doc.uploadedAt}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: confColor(doc.overallConfidence) }}>
                    {Math.round(doc.overallConfidence * 100)}%
                  </div>
                  <ConfBar value={doc.overallConfidence} width={56} height={4} />
                </div>
                <ArrowRight size={14} color={T.textTer} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── DETAIL VIEW ──
  const renderDetail = () => {
    if (!selected) return null;
    const st = STATUS[selected.status];
    return (
      <div style={{ padding: "24px 20px 20px" }}>
        {/* Back + header */}
        <button onClick={() => { setSelectedId(null); setEditField(null); }} style={{
          display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
          color: T.textSec, cursor: "pointer", fontSize: 12, fontWeight: 500,
          padding: 0, marginBottom: 20, fontFamily: "inherit",
        }}>
          <ChevronLeft size={14} /> Back to queue
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
              {selected.fields.vendor_name.value || "Unknown vendor"}
            </div>
            <div style={{ fontSize: 12, color: T.textTer }}>{selected.filename} · {selected.pageCount} page(s) · {selected.uploadedAt}</div>
          </div>
          <Badge status={selected.status} />
        </div>

        {/* Confidence overview */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
          background: confBg(selected.overallConfidence), borderRadius: 10, marginBottom: 20,
          border: `1px solid ${confColor(selected.overallConfidence)}22`,
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: confColor(selected.overallConfidence), letterSpacing: "-0.03em" }}>
            {Math.round(selected.overallConfidence * 100)}%
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Overall confidence</div>
            <div style={{ fontSize: 11, color: T.textSec }}>
              {selected.overallConfidence >= 0.85 ? "All fields look good" : selected.overallConfidence >= 0.55 ? "Some fields need verification" : "Multiple fields have low confidence"}
            </div>
          </div>
        </div>

        {/* Flags */}
        {selected.flags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {selected.flags.map((flag) => (
              <span key={flag} style={{
                display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                padding: "4px 10px", borderRadius: 6, color: T.red, background: T.redBg,
              }}>
                <AlertTriangle size={11} />
                {flag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* Fields */}
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Extracted fields
        </div>
        <div style={{
          border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 20,
        }}>
          {Object.entries(selected.fields).map(([key, field], i) => {
            const isEditing = editField === key;
            const label = FIELD_LABELS[key] || key;
            return (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderBottom: i < Object.keys(selected.fields).length - 1 ? `1px solid ${T.border}` : "none",
                background: isEditing ? T.surfaceActive : field.confidence < 0.55 ? T.redBg : "transparent",
                transition: "background 0.15s",
              }}>
                <div style={{ width: 110, fontSize: 11, color: T.textTer, fontWeight: 500, flexShrink: 0 }}>{label}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        autoFocus
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleFieldSave(selected.id, key); if (e.key === "Escape") setEditField(null); }}
                        style={{
                          flex: 1, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.accent}`,
                          background: T.surface, color: T.text, fontSize: 13, fontFamily: "inherit",
                          outline: "none",
                        }}
                      />
                      <button onClick={() => handleFieldSave(selected.id, key)} style={{
                        background: T.accentBg, border: "none", borderRadius: 6, padding: "4px 8px",
                        cursor: "pointer", display: "flex", alignItems: "center",
                      }}><Save size={13} color={T.accent} /></button>
                      <button onClick={() => setEditField(null)} style={{
                        background: T.surfaceActive, border: "none", borderRadius: 6, padding: "4px 8px",
                        cursor: "pointer", display: "flex", alignItems: "center",
                      }}><X size={13} color={T.textTer} /></button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: field.value != null ? T.text : T.red }}>
                        {field.value != null ? String(field.value) : "missing"}
                      </span>
                      {selected.status === "needs_review" && (
                        <button
                          onClick={() => { setEditField(key); setEditVal(field.value != null ? String(field.value) : ""); }}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: 2,
                            opacity: 0.4, transition: "opacity 0.15s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = 0.4}
                        >
                          <Pencil size={11} color={T.textSec} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: confColor(field.confidence), minWidth: 28, textAlign: "right" }}>
                    {Math.round(field.confidence * 100)}
                  </span>
                  <ConfBar value={field.confidence} width={48} height={4} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Line items */}
        {selected.lineItems.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Line items
            </div>
            <div style={{
              border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 24,
            }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 50px 80px 80px",
                padding: "8px 14px", background: T.surfaceActive, fontSize: 10,
                fontWeight: 600, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                <span>Description</span><span style={{ textAlign: "right" }}>Qty</span>
                <span style={{ textAlign: "right" }}>Price</span><span style={{ textAlign: "right" }}>Amount</span>
              </div>
              {selected.lineItems.map((li, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 50px 80px 80px",
                  padding: "10px 14px", borderTop: `1px solid ${T.border}`,
                  fontSize: 12, color: T.textSec,
                }}>
                  <span style={{ color: T.text, fontWeight: 500 }}>{li.desc}</span>
                  <span style={{ textAlign: "right" }}>{li.qty}</span>
                  <span style={{ textAlign: "right" }}>{fmtCurrency(li.price)}</span>
                  <span style={{ textAlign: "right", fontWeight: 600, color: T.text }}>{fmtCurrency(li.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          {selected.status === "needs_review" && (
            <button onClick={() => handleApprove(selected.id)} style={{
              flex: 1, padding: "12px", borderRadius: 10, border: "none",
              background: T.green, color: "#064E3B", fontSize: 13, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontFamily: "inherit", transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = 0.85}
            onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
            >
              <CheckCircle size={15} /> Approve extraction
            </button>
          )}
          {selected.status === "reviewed" && (
            <button onClick={() => handleSendBack(selected.id)} style={{
              flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${T.border}`,
              background: T.surface, color: T.textSec, fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontFamily: "inherit",
            }}>
              <RotateCcw size={14} /> Send back to review
            </button>
          )}
          {selected.status === "auto_approved" && (
            <div style={{
              flex: 1, padding: "12px", borderRadius: 10, background: T.greenBg,
              color: T.green, fontSize: 13, fontWeight: 600, textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <CheckCircle size={15} /> Auto-approved — no action needed
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={root}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; }
        input:focus { outline: none; box-shadow: 0 0 0 2px ${T.accent}44; }
        button:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 2px; }
        ::selection { background: ${T.accent}33; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
      `}</style>
      {selectedId && selected ? renderDetail() : renderList()}
    </div>
  );
}
