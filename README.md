# TAM-Copilot

Technical guide generator for Red Hat TAMs (Technical Account Managers). Transforms raw notes into polished, branded HTML documents using LLM-powered generation.

## Features

- **Multi-LLM support** — LiteMaaS (default), OpenAI, Anthropic, Google Gemini
- **Guide generation** — structured JSON → Jinja2 HTML with Red Hat visual identity
- **Document types** — Technical Guide, RCA, Meeting Notes, Action Plan, TAM Report, KCS Article
- **Intelligent search** — full-text (FTS5) + semantic (embedding cosine similarity)
- **Duplicate detection** — warns before generating content similar to existing guides
- **Dashboard analytics** — guides per month, per customer, per product
- **Customer & product management** — organize guides by client and Red Hat product

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  React SPA  │────▶│  FastAPI      │────▶│  SQLite    │
│  PatternFly │     │  + Jinja2     │     │  + FTS5    │
└─────────────┘     └──────┬───────┘     └────────────┘
                           │
                    ┌──────▼───────┐
                    │  LLM Provider │
                    │  (LiteMaaS)   │
                    └──────────────┘
```

| Layer | Stack |
|-------|-------|
| Frontend | React 18, Vite, TypeScript, PatternFly v5 |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 |
| Database | SQLite + aiosqlite, FTS5, Alembic migrations |
| LLM | OpenAI SDK (LiteMaaS), Anthropic SDK, Google GenAI |
| Search | nomic-embed-text-v1-5 embeddings, numpy cosine similarity |

## Quick Start (local)

```bash
# Clone
git clone git@github.com:andersonid/tam-copilot.git
cd tam-copilot

# Create .env
cp .env.example .env
# Edit .env with your LiteMaaS API key

# Run with podman-compose
podman-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/health

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLAlchemy database URI | `sqlite+aiosqlite:///./data/tam_copilot.db` |
| `DATA_DIR` | Directory for data/html storage | `./data` |
| `SECRET_KEY` | Encryption key for API keys at rest | (required) |
| `DEFAULT_PROVIDER_NAME` | Default LLM provider display name | `LiteMaaS` |
| `DEFAULT_PROVIDER_TYPE` | Provider type (`openai_compatible`, `anthropic`, `gemini`) | `openai_compatible` |
| `DEFAULT_PROVIDER_BASE_URL` | LLM API base URL | LiteMaaS endpoint |
| `DEFAULT_PROVIDER_API_KEY` | LLM API key | (required) |
| `DEFAULT_PROVIDER_MODEL` | Default model for generation | `qwen3-14b` |
| `EMBEDDING_MODEL` | Model for semantic search embeddings | `nomic-embed-text-v1-5` |
| `SIMILARITY_THRESHOLD` | Cosine similarity threshold for duplicate detection | `0.82` |

## Deployment (Kubernetes)

The application deploys to a k3s cluster via Tekton CI/CD + ArgoCD GitOps.

```
k8s/
├── deployment.yaml      # App deployment
├── service.yaml         # ClusterIP service
├── ingressroute.yaml    # Traefik IngressRoute (HTTPS)
├── pvc.yaml             # Persistent storage (2Gi)
├── sealed-env.yaml      # SealedSecret (encrypted env vars)
└── kustomization.yaml   # Kustomize manifest list
```

**Pipeline:** GitHub push → Tekton webhook → `build-push` Pipeline (Buildah) → registry → ArgoCD auto-sync

**URL:** https://tam-copilot.nobre.ninja

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET/POST` | `/api/customers` | Customer CRUD |
| `GET/POST` | `/api/products` | Product CRUD |
| `GET/POST` | `/api/document-types` | Document type CRUD |
| `GET/POST` | `/api/guides` | Guide CRUD + generation |
| `GET/POST` | `/api/providers` | LLM provider CRUD |
| `GET` | `/api/search` | Full-text + semantic search |
| `GET` | `/api/analytics/dashboard` | Dashboard metrics |

## Project Structure

```
tam-copilot/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + SPA serving
│   │   ├── config.py            # Pydantic settings
│   │   ├── database.py          # SQLAlchemy async engine
│   │   ├── models.py            # ORM models
│   │   ├── schemas.py           # Pydantic request/response
│   │   ├── seed.py              # Default data seeder
│   │   ├── routers/             # API route handlers
│   │   ├── llm/                 # LLM clients + generation
│   │   └── templates/           # Jinja2 HTML templates
│   ├── alembic/                 # Database migrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/               # React page components
│   │   └── App.tsx              # Router + layout
│   └── package.json
├── k8s/                         # Kubernetes manifests
├── Dockerfile                   # Multi-stage build
├── compose.yaml                 # Local dev (podman-compose)
└── README.md
```

## License

Internal Red Hat tool — not for public distribution.
