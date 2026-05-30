const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      try { detail = await res.text(); } catch { /* ignore */ }
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listDocuments: (status) =>
    request(`/api/documents${status && status !== "all" ? `?status=${status}` : ""}`),

  getDocument: (id) => request(`/api/documents/${id}`),

  uploadDocument: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/api/documents/upload", { method: "POST", body: fd });
  },

  updateField: (id, fieldName, value) =>
    request(`/api/documents/${id}/fields/${encodeURIComponent(fieldName)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: String(value) }),
    }),

  approveDocument: (id) =>
    request(`/api/documents/${id}/approve`, { method: "POST" }),

  rejectDocument: (id) =>
    request(`/api/documents/${id}/reject`, { method: "POST" }),

  getStats: () => request("/api/stats"),

  getAnalytics: () => request("/api/analytics"),

  getHealth: () => request("/api/health"),
};

export { API_BASE };
