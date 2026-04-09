import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse

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


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    async with async_session() as db:
        await seed_data(db)
    logger.info("startup.complete | ready to serve")
    yield
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

from .routers import health, customers, products, document_types, guides, providers, search, analytics  # noqa: E402

app.include_router(health.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(document_types.router, prefix="/api")
app.include_router(guides.router, prefix="/api")
app.include_router(providers.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")

html_path = Path(settings.data_dir) / "html"
html_path.mkdir(parents=True, exist_ok=True)
app.mount("/guides/html", StaticFiles(directory=str(html_path)), name="guide_html")

static_dir = Path(settings.static_dir)
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")
