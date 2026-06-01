# Deployment Guide

DocLens deploys as two services (API + dashboard) plus Postgres. This guide
covers the three most useful options:

1. **Railway** — easiest, free tier, deploys from GitHub *(recommended for portfolio)*
2. **Fly.io** — more flexible, also free for hobby projects
3. **Self-hosted** — `docker compose -f docker-compose.prod.yml up -d` on any VPS

All cloud deployments run in **DEMO_MODE** (no VLM, mock extractions) since
GPU instances aren't free. Real VLM inference still runs locally with your GPU.

---

## 1. Railway *(recommended)*

### One-time setup

1. Sign up at [railway.app](https://railway.app) (GitHub login works).
2. Click **New Project → Deploy from GitHub repo** → pick your `DocLens-` repo.
3. Railway detects two Dockerfiles. Create **two services** in the same project:
   - **api** service, root directory `/`, Dockerfile path `api/Dockerfile`
   - **dashboard** service, root directory `/dashboard`, Dockerfile path `Dockerfile`
4. Add a **Postgres** add-on (New → Database → PostgreSQL).

### Environment variables

**On the `api` service**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (link to the Postgres service) |
| `DOCLENS_DEMO_MODE` | `true` |
| `CORS_ORIGINS` | `https://your-dashboard.up.railway.app` *(fill in after first deploy)* |
| `AUTO_APPROVE_THRESHOLD` | `0.85` |
| `UPLOAD_DIR` | `/tmp/uploads` |

Make sure the `DATABASE_URL` from Railway uses the `postgresql+asyncpg://` prefix.
If Railway gives you `postgres://`, override it to:
`postgresql+asyncpg://USER:PASS@HOST:PORT/DB`

**On the `dashboard` service**, add a **build-time** variable:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-api.up.railway.app` |

(Set it in the service's *Variables* tab and choose "Build-time" so Vite picks
it up. Then trigger a redeploy.)

### Generate public domains

For each service: *Settings → Networking → Generate Domain*. Copy the
dashboard URL back into the API's `CORS_ORIGINS`, redeploy the API.

### Done

Open the dashboard URL. Upload `sample_invoice.pdf`. Watch it process and
auto-approve. **That's your live demo for LinkedIn.**

---

## 2. Fly.io

Install `flyctl`, then from the repo root:

```bash
# API
fly launch --dockerfile api/Dockerfile --no-deploy --name doclens-api
fly postgres create --name doclens-db
fly postgres attach doclens-db -a doclens-api
fly secrets set DOCLENS_DEMO_MODE=true -a doclens-api
fly deploy -a doclens-api

# Dashboard
cd dashboard
fly launch --dockerfile Dockerfile --no-deploy --name doclens-dashboard \
    --build-arg VITE_API_URL=https://doclens-api.fly.dev
fly deploy -a doclens-dashboard
```

Then set `CORS_ORIGINS=https://doclens-dashboard.fly.dev` on the API and
redeploy: `fly secrets set CORS_ORIGINS=... -a doclens-api`.

---

## 3. Self-hosted (any VPS with Docker)

```bash
git clone https://github.com/MouzaiNoufel/DocLens-.git doclens
cd doclens
docker compose -f docker-compose.prod.yml up -d --build
```

Dashboard at `http://your-server`, API at `http://your-server:8000`.

For real VLM extraction on a GPU-equipped host:
1. Set `DOCLENS_DEMO_MODE=false` in `docker-compose.prod.yml`.
2. Switch the API image base to a CUDA-capable one (e.g.
   `nvidia/cuda:12.1.0-runtime-ubuntu22.04`) and install the full
   `requirements.txt` instead of `requirements-deploy.txt`.
3. Add `deploy.resources.reservations.devices` with the GPU to the api service.

---

## Verifying the deploy

```bash
# API health
curl https://your-api.up.railway.app/api/health
# → {"status":"ok","service":"doclens"}

# Upload a doc
curl -X POST https://your-api.up.railway.app/api/documents/upload \
    -F "file=@sample_invoice.pdf"

# List (after ~3s)
curl https://your-api.up.railway.app/api/documents
```

If any of those fail, check the service logs in Railway's dashboard — the
most common issue is `CORS_ORIGINS` not matching the dashboard's actual URL.

---

## Adding the live URL to your portfolio

Once deployed, add to your GitHub README and LinkedIn:

> **Live demo**: https://your-dashboard.up.railway.app
> *(Demo mode — extraction returns realistic mock data. Run locally with a
> CUDA GPU for real VLM inference.)*

That disclosure is honest and recruiters appreciate the architectural
explanation; demo mode actually highlights your design thinking.
