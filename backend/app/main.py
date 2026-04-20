from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import routers as auth_routers
from app.db import locations_router
from app.db import walks_router
from app.db import websockets_router
from app.core.config.settings import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup if they don't exist
    from app.db.session.database import engine
    import app.db.base_models  # noqa — registers all models
    from app.db.base.base_class import Base
    Base.metadata.create_all(bind=engine)
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
    "http://localhost:3000",   # Next.js dev server
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    # Add production URL here when deploying, e.g. "https://pathguard.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_routers.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(locations_router.router, prefix=f"{settings.API_V1_STR}/locations", tags=["locations"])
app.include_router(walks_router.router, prefix=f"{settings.API_V1_STR}/walks", tags=["walks"])
app.include_router(websockets_router.router, prefix=f"{settings.API_V1_STR}/ws", tags=["websocket"])

@app.get("/")
def root():
    return {"message": "Welcome to PathGuard API"}
