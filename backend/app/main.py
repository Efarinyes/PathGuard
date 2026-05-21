from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.api.auth import routers as auth_routers
from app.api.routers import locations as locations_router
from app.api.routers import walks as walks_router
from app.api.routers import analytics as analytics_router
from app.api.routers import sos as sos_router
from app.api.routers import patient as patient_router
from app.api.routers import groups as groups_router
from app.api.websocket import websocket_endpoint as websockets_router
from app.core.config.settings import settings
from app.core.constants import CACHE_MAX_AGE_SECONDS

STATIC_EXTENSIONS = {".png", ".ico", ".jpg", ".svg", ".webp"}


class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        path = request.url.path

        if path.startswith(settings.API_V1_STR):
            response.headers["Cache-Control"] = "no-store"
        elif path.endswith(".js") or path.endswith(".js/"):
            response.headers["Cache-Control"] = f"public, max-age={CACHE_MAX_AGE_SECONDS}, immutable"
        elif any(ext in path for ext in STATIC_EXTENSIONS):
            response.headers["Cache-Control"] = f"public, max-age={CACHE_MAX_AGE_SECONDS}, immutable"
        elif "pathguard-sw" in path:
            response.headers["Cache-Control"] = "no-cache"

        return response

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup if they don't exist
    from app.db.session.database import engine
    import app.db.models.base  # noqa — registers all models
    from app.db.base.base_class import Base
    Base.metadata.create_all(bind=engine)

    # Setup WebSocket event handlers (broadcast subscriptions)
    from app.api.websocket import setup_websocket_events
    setup_websocket_events()

    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# NOTE: allow_origins=["*"] is incompatible with allow_credentials=True.
# Browsers reject credentialed requests to wildcard origins per the CORS spec.
# Specify the frontend origin explicitly instead.
ALLOWED_ORIGINS = [
    settings.FRONTEND_URL,
    "http://localhost:3000",   # Next.js dev server fallback
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(CacheControlMiddleware)

# Include Routers
app.include_router(auth_routers.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(locations_router.router, prefix=f"{settings.API_V1_STR}/locations", tags=["locations"])
app.include_router(walks_router.router, prefix=f"{settings.API_V1_STR}/walks", tags=["walks"])
app.include_router(analytics_router.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["analytics"])
app.include_router(sos_router.router, prefix=f"{settings.API_V1_STR}/sos", tags=["sos"])
app.include_router(groups_router.router, prefix=f"{settings.API_V1_STR}/groups", tags=["groups"])
app.include_router(patient_router.router, prefix=f"{settings.API_V1_STR}/patient", tags=["patient"])
app.include_router(websockets_router.router, prefix=f"{settings.API_V1_STR}/ws", tags=["websocket"])

@app.get("/")
def root():
    return {"message": "Welcome to PathGuard API"}
