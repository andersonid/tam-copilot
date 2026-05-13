import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse, HTMLResponse

from .config import settings
from .database import engine, async_session, Base
from .seed import seed_data

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
    force=True,
)
logging.getLogger("tam_copilot").setLevel(logging.DEBUG)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger("tam_copilot.app")


import httpx  # noqa: E402

_sync_service: "SyncService | None" = None  # populated during startup


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _sync_service

    logger.info("startup | data_dir=%s static_dir=%s", settings.data_dir, settings.static_dir)
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
    settings.html_dir
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            __import__("sqlalchemy").text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS guide_fts "
                "USING fts5(title, input_notes, content='guides', content_rowid='id')"
            )
        )

        # Inline migrations: add columns missing from older SQLite schemas.
        # Each ALTER is wrapped individually — duplicate-column errors are
        # silently ignored so the startup is idempotent.
        import secrets as _secrets
        _text = __import__("sqlalchemy").text

        _admin_cols = [
            ("email", "VARCHAR(255)"),
            ("full_name", "VARCHAR(255)"),
            ("sso_username", "VARCHAR(100)"),
            ("role", "VARCHAR(20) DEFAULT 'tam'"),
            ("tam_type", "VARCHAR(50)"),
            ("certifications_json", "TEXT"),
            ("skills_tags", "TEXT"),
            ("service_days_config_json", "TEXT"),
            ("updated_at", "DATETIME"),
        ]
        for col, typedef in _admin_cols:
            try:
                await conn.execute(_text(f"ALTER TABLE admin_users ADD COLUMN {col} {typedef}"))
                logger.info("startup.migration | admin_users.%s added", col)
            except Exception:
                pass

        for col, typedef in (
            ("manager_id", "INTEGER REFERENCES admin_users(id)"),
            ("is_active", "BOOLEAN DEFAULT 1 NOT NULL"),
        ):
            try:
                await conn.execute(_text(f"ALTER TABLE admin_users ADD COLUMN {col} {typedef}"))
                logger.info("startup.migration | admin_users.%s added", col)
            except Exception:
                pass
        try:
            await conn.execute(_text("UPDATE admin_users SET is_active = 1 WHERE is_active IS NULL"))
        except Exception:
            pass

        _guide_cols = [
            ("access_token", "VARCHAR(64) DEFAULT ''"),
            ("account_id", "INTEGER REFERENCES accounts(id)"),
        ]
        for col, typedef in _guide_cols:
            try:
                await conn.execute(_text(f"ALTER TABLE guides ADD COLUMN {col} {typedef}"))
                logger.info("startup.migration | guides.%s added", col)
            except Exception:
                pass

        # Rename touchpoints.date -> touchpoints.touchpoint_date (SQLite)
        try:
            await conn.execute(_text("ALTER TABLE touchpoints RENAME COLUMN date TO touchpoint_date"))
            logger.info("startup.migration | touchpoints.date renamed to touchpoint_date")
        except Exception:
            pass

        for col, typedef in (
            ("vertical_id", "INTEGER REFERENCES verticals(id)"),
            ("segment_id", "INTEGER REFERENCES segments(id)"),
        ):
            try:
                await conn.execute(_text(f"ALTER TABLE accounts ADD COLUMN {col} {typedef}"))
                logger.info("startup.migration | accounts.%s added", col)
            except Exception:
                pass

        for col, typedef in (
            ("has_tam", "BOOLEAN DEFAULT 0"),
            ("csm_name", "VARCHAR(255)"),
            ("csm_sso_username", "VARCHAR(100)"),
            ("strategic", "BOOLEAN DEFAULT 0"),
        ):
            try:
                await conn.execute(_text(f"ALTER TABLE accounts ADD COLUMN {col} {typedef}"))
                logger.info("startup.migration | accounts.%s added", col)
            except Exception:
                pass

        for tbl in ("account_entitlements", "account_assignments"):
            try:
                await conn.execute(
                    _text(f"ALTER TABLE {tbl} ADD COLUMN product_id INTEGER REFERENCES products(id)")
                )
                logger.info("startup.migration | %s.product_id added", tbl)
            except Exception:
                pass

        # Backfill account_assignments from legacy tam_user_id
        try:
            await conn.execute(_text("""
                INSERT OR IGNORE INTO account_assignments
                (account_id, user_id, assignment_type, specialization, is_primary, assigned_at, assigned_by_id)
                SELECT id, tam_user_id, 'tam', NULL, 1, datetime('now'), NULL
                FROM accounts
                WHERE tam_user_id IS NOT NULL
            """))
            logger.info("startup.migration | account_assignments backfilled from tam_user_id")
        except Exception as e:
            logger.debug("startup.migration | account_assignments backfill skipped: %s", e)

        # Backfill empty access tokens
        try:
            rows = (await conn.execute(_text("SELECT id FROM guides WHERE access_token = '' OR access_token IS NULL"))).fetchall()
            for row in rows:
                await conn.execute(
                    _text("UPDATE guides SET access_token = :t WHERE id = :id"),
                    {"t": _secrets.token_urlsafe(24), "id": row[0]},
                )
            if rows:
                logger.info("startup.migration | backfilled access_token for %d guides", len(rows))
        except Exception:
            pass
    async with async_session() as db:
        await seed_data(db)

    # Initialize Red Hat API clients when SSO token is available
    from .services.redhat_auth import RedHatAuth
    from .services.hydra_client import HydraClient
    from .services.ocm_client import OcmClient
    from .services.lifecycle_client import LifecycleClient
    from .services.sync import SyncService

    http = httpx.AsyncClient(verify=False, timeout=settings.api_timeout)
    hydra_client, ocm_client, lifecycle_client = None, None, None

    if settings.hydra_offline_token:
        auth = RedHatAuth(settings.hydra_offline_token, http)
        hydra_client = HydraClient(settings.hydra_base_url, auth, http)
        ocm_client = OcmClient(settings.ocm_base_url, auth, http)
        logger.info("startup.api | hydra + ocm clients initialized")
    else:
        logger.warning("startup.api | HYDRA_OFFLINE_TOKEN not set — sync disabled")

    lifecycle_client = LifecycleClient(settings.lifecycle_base_url, http)

    _sync_service = SyncService(hydra_client, ocm_client, lifecycle_client)
    logger.info("startup.complete | ready to serve")

    yield

    await http.aclose()
    _sync_service = None
    logger.info("shutdown | disposing engine")
    await engine.dispose()


app = FastAPI(title="TAM-Copilot", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .routers import (  # noqa: E402
    health, customers, products, document_types, guides, providers,
    search, analytics, auth,
    accounts, verticals, segments, team, manager, admin_users,
    clusters, entitlements, contacts, issues,
    action_plans, touchpoints, risks, engagements, lifecycle, nps,
    sync, reports, kcs,
)
from .auth import get_current_user  # noqa: E402

_auth_dep = [Depends(get_current_user)]

app.include_router(auth.router, prefix="/api")
app.include_router(health.router, prefix="/api")

# Account management (new)
app.include_router(accounts.router, prefix="/api", dependencies=_auth_dep)
app.include_router(verticals.router, prefix="/api", dependencies=_auth_dep)
app.include_router(segments.router, prefix="/api", dependencies=_auth_dep)
app.include_router(team.router, prefix="/api", dependencies=_auth_dep)
app.include_router(admin_users.router, prefix="/api", dependencies=_auth_dep)
app.include_router(manager.router, prefix="/api", dependencies=_auth_dep)
app.include_router(clusters.router, prefix="/api", dependencies=_auth_dep)
app.include_router(entitlements.router, prefix="/api", dependencies=_auth_dep)
app.include_router(contacts.router, prefix="/api", dependencies=_auth_dep)
app.include_router(issues.router, prefix="/api", dependencies=_auth_dep)
app.include_router(action_plans.router, prefix="/api", dependencies=_auth_dep)
app.include_router(touchpoints.router, prefix="/api", dependencies=_auth_dep)
app.include_router(risks.router, prefix="/api", dependencies=_auth_dep)
app.include_router(engagements.router, prefix="/api", dependencies=_auth_dep)
app.include_router(lifecycle.router, prefix="/api", dependencies=_auth_dep)
app.include_router(nps.router, prefix="/api", dependencies=_auth_dep)
app.include_router(sync.router, prefix="/api", dependencies=_auth_dep)
app.include_router(reports.router, prefix="/api", dependencies=_auth_dep)
app.include_router(kcs.router, prefix="/api", dependencies=_auth_dep)

# Content generation & legacy (existing)
app.include_router(customers.router, prefix="/api", dependencies=_auth_dep)
app.include_router(products.router, prefix="/api", dependencies=_auth_dep)
app.include_router(document_types.router, prefix="/api", dependencies=_auth_dep)
app.include_router(guides.router, prefix="/api", dependencies=_auth_dep)
app.include_router(providers.router, prefix="/api", dependencies=_auth_dep)
app.include_router(search.router, prefix="/api", dependencies=_auth_dep)
app.include_router(analytics.router, prefix="/api", dependencies=_auth_dep)

from .database import get_db, async_session as _async_session  # noqa: E402 (re-import for routes below)
from .models import Guide as _Guide  # noqa: E402
from sqlalchemy import select as _select  # noqa: E402
from pydantic import BaseModel as _BaseModel  # noqa: E402


class _TokenVerify(_BaseModel):
    token: str


@app.post("/api/public/guides/{guide_id}/verify")
async def verify_public_guide(guide_id: int, body: _TokenVerify):
    """Validate access token and return guide HTML content."""
    async with _async_session() as db:
        guide = await db.scalar(
            _select(_Guide).where(_Guide.id == guide_id, _Guide.access_token == body.token)
        )
    if not guide or not guide.html_filename:
        raise HTTPException(403, "Invalid token or guide not found")
    html_path = Path(settings.data_dir) / "html" / guide.html_filename
    if not html_path.exists():
        raise HTTPException(404, "Guide file not found")
    return {"title": guide.title, "html": html_path.read_text(encoding="utf-8")}


@app.get("/api/public/guides/{guide_id}/info")
async def public_guide_info(guide_id: int):
    """Return minimal public metadata (title only) — no auth required."""
    async with _async_session() as db:
        guide = await db.scalar(_select(_Guide).where(_Guide.id == guide_id))
    if not guide:
        raise HTTPException(404, "Guide not found")
    return {"id": guide.id, "title": guide.title}


from .models import AssessmentResponse as _AssessmentResponse  # noqa: E402
from .schemas import AssessmentResponseCreate as _AssessmentResponseCreate  # noqa: E402
from .schemas import AssessmentResponseRead as _AssessmentResponseRead  # noqa: E402
import json as _json  # noqa: E402


@app.post("/api/public/guides/{guide_id}/respond", status_code=201)
async def submit_assessment_response(guide_id: int, body: _AssessmentResponseCreate, token: str = Query(...)):
    """Public token-gated endpoint for clients to submit assessment responses."""
    async with _async_session() as db:
        guide = await db.scalar(
            _select(_Guide).where(_Guide.id == guide_id, _Guide.access_token == token)
        )
        if not guide:
            raise HTTPException(403, "Invalid token or guide not found")

        response = _AssessmentResponse(
            guide_id=guide_id,
            respondent_name=body.respondent_name,
            responses_json=_json.dumps(body.responses),
        )
        db.add(response)
        await db.commit()
        await db.refresh(response)
        logger.info("assessment.response.submitted | guide_id=%d respondent=%s", guide_id, body.respondent_name)
        return {"id": response.id, "message": "Response submitted successfully"}


@app.get("/api/guides/{guide_id}/responses", response_model=list[_AssessmentResponseRead],
         dependencies=[Depends(get_current_user)])
async def get_assessment_responses(guide_id: int):
    """Admin-only: list all assessment responses for a guide."""
    async with _async_session() as db:
        result = await db.execute(
            _select(_AssessmentResponse)
            .where(_AssessmentResponse.guide_id == guide_id)
            .order_by(_AssessmentResponse.submitted_at.desc())
        )
        return result.scalars().all()


static_dir = Path(settings.static_dir)
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")
