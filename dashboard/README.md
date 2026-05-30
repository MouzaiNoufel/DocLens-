# DocLens Dashboard

React review dashboard for the DocLens IDP API. Upload invoices, see them processed
in real time, review and correct low-confidence fields, and approve.

## Run

Make sure the API is running first (from the project root):

```bash
uvicorn api.main:app --reload
```

Then in this folder:

```bash
npm install
npm run dev
```

Dashboard opens at **http://localhost:5173**. It expects the API at
`http://localhost:8000` by default.

## Point at a different API host

Create `dashboard/.env.local`:

```
VITE_API_URL=http://your-api-host:8000
```

## What's wired up

- **Upload** — drag/click → `POST /api/documents/upload`, kicks off background extraction
- **Live updates** — polls the list every 3s while any document is processing
- **Review** — click a document → field-by-field with per-field confidence + edit
- **Correct** — pencil edit → `PATCH /api/documents/{id}/fields/{field_name}`
- **Approve** — `POST /api/documents/{id}/approve`
- **Send back to review** — `POST /api/documents/{id}/reject`
- **Filter** — All / Review / Approved / Done

The visual prototype lives at `../doclens-dashboard.jsx` (mock data, no API).
