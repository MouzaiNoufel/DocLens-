# DocLens

An intelligent document processing (IDP) system for invoices. Upload a PDF or
image, a vision-language model extracts structured fields, business rules
validate them, and each document is routed to **auto-approve** or a
**human-review queue** based on confidence. A React dashboard handles upload,
review, correction, approval, and analytics.

**Try it live:** https://dashboard-production-7a83.up.railway.app/

> The live deployment runs in **demo mode** (no GPU on the free tier), so
> extractions return realistic mock data. Upload → processing → routing →
> review → approve → analytics all work exactly as in production. Run locally
> with a CUDA GPU for real VLM inference (see [Local development with a real
> GPU](#local-development-with-a-real-gpu)).

## What's in the box

```
PDF / image  →  preprocess  →  extraction  →  validate + route  →  dashboard
              (PyMuPDF)        (Qwen2.5-VL,    (rules sharpen      (review,
                                 4-bit)         model confidence)   correct,
                                                                    analytics)
```

- **`invoice_idp/`** — the core extraction pipeline (preprocess, VLM extractor, validator)
- **`api/`** — FastAPI service: upload, async background extraction, CRUD, analytics
- **`dashboard/`** — React + Vite review dashboard (upload, queue, field-level review, charts)
- **`docker-compose.prod.yml`** — full stack (api + dashboard + Postgres) for self-hosting
- **`DEPLOYMENT.md`** — Railway / Fly.io / self-hosted guides

## Why it's structured this way

The extractor returns field values **and** a per-field confidence map. The
validator sharpens that with hard checks — required fields present, dates
parseable, `subtotal + tax == total`, line items reconcile — then decides
routing. Rule-driven confidence is more trustworthy for routing than a
model's self-report alone, which is the difference between a demo and
something a finance team would actually plug in.

## Quickstart

### Option A — try the hosted demo

Open the [live dashboard](https://dashboard-production-7a83.up.railway.app/)
and upload any invoice PDF or image. Watch it move through `processing →
auto_approved` (or `needs_review` ~12% of the time, when the demo pipeline
injects a `totals_mismatch`).

### Option B — full stack locally with Docker

```bash
docker compose -f docker-compose.prod.yml up -d --build
# Dashboard: http://localhost
# API:       http://localhost:8000/docs
```

This runs api + dashboard + Postgres in demo mode (no GPU needed) and is the
fastest way to see the whole thing working on your machine.

### Option C — dev mode (hot reload)

```bash
# 1. API
python -m venv .venv
source .venv/bin/activate          # PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt    # see GPU note below
uvicorn api.main:app --reload      # http://localhost:8000/docs

# 2. Dashboard (new terminal)
cd dashboard
npm install
npm run dev                        # http://localhost:5173
```

By default the API uses SQLite (`./doclens.db`) and runs the real VLM. To
skip the model and use mock extractions, set `DOCLENS_DEMO_MODE=true` before
starting uvicorn — handy when you want to iterate on the dashboard without a
GPU.

## Local development with a real GPU

Real VLM extraction needs an NVIDIA GPU with **16GB+ VRAM** (built and tuned
for an RTX 5080) and a recent CUDA runtime.

```bash
# Install the CUDA build of PyTorch for your system. Example (CUDA 12.1):
pip install torch --index-url https://download.pytorch.org/whl/cu121
#   Pick the right command at https://pytorch.org/get-started/locally/

pip install -r requirements.txt
```

**Windows note:** `bitsandbytes` 4-bit quantization is smoothest under
**WSL2**. If you can't use WSL2, run without quantization
(`load_in_4bit=False` in `InvoiceExtractor`), but the 3B model in fp16 needs
~7GB+ and is tight on 8GB.

CLI run, without the API:

```bash
python run.py path/to/invoice.pdf
python run.py invoice.png --threshold 0.9       # stricter auto-approve bar
python run.py invoice.pdf --max-pixels 1048576  # 1024*1024, lower VRAM if you OOM
python run.py invoice.pdf --model Qwen/Qwen2-VL-2B-Instruct  # smaller fallback
```

## Output shape

```json
{
  "fields": {
    "vendor_name": "Acme Supplies Ltd",
    "invoice_number": "INV-2024-0342",
    "invoice_date": "2024-03-14",
    "currency": "USD",
    "line_items": [ ... ],
    "subtotal": 1200.0,
    "tax": 96.0,
    "total": 1296.0
  },
  "field_confidence": { "vendor_name": 0.93, "total": 0.99 },
  "overall_confidence": 0.93,
  "flags": [],
  "routing": "auto_approved"
}
```

- `routing: "auto_approved"` — confidence cleared the threshold, no critical flags.
- `routing: "needs_review"` — missing required field, `totals_mismatch`,
  unparseable date, or low confidence. Shows up in the dashboard's review queue.

## API surface

Full interactive docs at `/docs` (Swagger) when the API is running.

| Method | Path | Purpose |
|---|---|---|
| `POST`  | `/api/documents/upload` | Upload PDF/image, start background extraction |
| `GET`   | `/api/documents` | List documents (filterable by `status`) |
| `GET`   | `/api/documents/{id}` | Full document detail with fields + line items |
| `PATCH` | `/api/documents/{id}/fields/{name}` | Correct a field (tracked for active learning) |
| `POST`  | `/api/documents/{id}/approve` | Mark reviewed |
| `POST`  | `/api/documents/{id}/reject`  | Send back to review queue |
| `GET`   | `/api/stats` | Status counts for the dashboard summary cards |
| `GET`   | `/api/analytics` | KPIs, throughput, confidence distribution, field accuracy, top flags |
| `GET`   | `/api/health` | `{"status":"ok","service":"doclens"}` |

## Configuration

All via environment variables (see [env.example](env.example)):

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./doclens.db` | Postgres: `postgresql+asyncpg://user:pass@host/db` |
| `UPLOAD_DIR` | `./uploads` | Where uploaded files are stored |
| `AUTO_APPROVE_THRESHOLD` | `0.85` | Overall confidence required for auto-approve |
| `MODEL_NAME` | `Qwen/Qwen2.5-VL-3B-Instruct` | VLM (real mode only) |
| `MAX_PIXELS` | `1638400` | Vision pixel budget (lower if you OOM) |
| `DOCLENS_DEMO_MODE` | `false` | `true` → skip VLM, return realistic mocks |
| `CORS_ORIGINS` | localhost dev ports | Comma-separated list of allowed origins |

## VRAM tuning (8 GB)

Vision-token count is the main driver of VRAM. If you hit CUDA OOM, in order:
lower `MAX_PIXELS` (try `1048576`), then drop `--dpi` to 150, then switch to
`Qwen/Qwen2-VL-2B-Instruct`.

## Deployment

Full guides for Railway, Fly.io, and self-hosted Docker in
[DEPLOYMENT.md](DEPLOYMENT.md). Two requirements files keep the cloud image
under ~500 MB by excluding torch/transformers:

- [requirements.txt](requirements.txt) — full deps for local dev with a GPU
- [api/requirements-deploy.txt](api/requirements-deploy.txt) — slim deps for the demo-mode cloud image

`DOCLENS_DEMO_MODE` is a **runtime** flag, so the same image serves both
modes. The dashboard is a multi-stage Node-build → nginx image (~30 MB).

## How demo mode works

When `DOCLENS_DEMO_MODE=true`, `_sync_pipeline()` in
[api/tasks.py](api/tasks.py) calls `_demo_pipeline()` instead of the VLM. It:

- Loads the PDF/image with PyMuPDF (page count is real)
- Sleeps 1.5–3.5s to simulate VLM latency
- Picks a random vendor from a fixed list, generates realistic totals + tax
- 12% of the time injects a `totals_mismatch` so the flags chart isn't empty
- Self-reports per-field confidence with distributions tuned to look real
- Runs the **real** `validate_and_route()` so routing, flags, and the
  needs-review queue are genuinely exercised

This means the deployed demo has fully working upload, async processing,
status transitions, field correction, approve/reject, and analytics —
everything except the VLM itself.

## Project layout

```
api/                       FastAPI service
  ├─ main.py               app + CORS from env
  ├─ config.py             env-driven settings (DEMO_MODE, CORS_ORIGINS, ...)
  ├─ database.py           async SQLAlchemy (SQLite / Postgres)
  ├─ models.py             ORM: Document, ExtractionField, LineItem
  ├─ schemas.py            Pydantic request/response shapes
  ├─ tasks.py              real VLM pipeline + demo pipeline
  ├─ routes/               documents, stats, analytics
  ├─ Dockerfile            slim cloud image (no torch)
  └─ requirements-deploy.txt

dashboard/                 React + Vite review UI
  ├─ src/App.jsx           queue + review + correction flow
  ├─ src/Analytics.jsx     charts (recharts)
  ├─ src/api.js            API client (uses VITE_API_URL)
  ├─ Dockerfile            multi-stage: Node build → nginx serve
  └─ nginx.conf            SPA routing, gzip, security headers

invoice_idp/               Core extraction pipeline
  ├─ preprocess.py         PDF/image → RGB page images
  ├─ extractor.py          Qwen2.5-VL 4-bit, JSON-mode prompt
  ├─ validate.py           rules + confidence sharpening + routing
  └─ schema.py             InvoiceFields + ExtractionResult

docker-compose.prod.yml    Full stack for self-hosting
docker-compose.yml         Just Postgres, for local dev
DEPLOYMENT.md              Railway / Fly.io / self-hosted guides
run.py                     CLI: run the extraction pipeline on one file
```

## Roadmap

- [x] **Phase 1–2** — ingest, preprocess, VLM extraction, validation + routing
- [x] **Phase 3** — service layer: FastAPI, async SQLAlchemy, background tasks, Postgres-ready
- [x] **Phase 4** — review dashboard: upload, queue, field-level review, correct & approve
- [x] **Phase 5** — analytics: KPIs, throughput, confidence distribution, field accuracy, top flags
- [x] **Phase 7** — deploy: Docker images, Railway / Fly.io / self-host, live demo URL
- [ ] **Phase 6** — active learning: train a Donut / LayoutLMv3 on collected corrections, benchmark vs. VLM
- [ ] Multi-tenant (Organization scoping), auth (JWT), webhooks, SSE for real-time updates

## License

MIT.
