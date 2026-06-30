---
name: pathguard-backend-stack
description: |
  Detall de l'stack backend (FastAPI 0.136, SQLAlchemy 2.0,
  Pydantic v2, dual DB SQLite/PostgreSQL). Carregar quan
  la tasca requereixi saber versions o patrons específics.
triggers:
  - Afegir endpoint
  - Modificar model
  - Decidir entre SQLite i PostgreSQL
  - Errors de CORS, auth, WebSocket
agent_owner: backend
prerequisites:
  - pathguard-agent-backend
---

# Backend Stack — Detall tècnic

## Versions exactes

| Component | Versió | Notes |
|---|---|---|
| Python | 3.11.* | Runtime Render |
| FastAPI | 0.136.0 | Async, OpenAPI auto |
| SQLAlchemy | 2.0.49 | ORM 2.0 style |
| Pydantic | 2.13.2 | v2 (amb `ConfigDict`) |
| Alembic | (no usat) | `Base.metadata.create_all` a startup |
| python-jose | 3.5.0 | JWT |
| passlib[bcrypt] | 1.7.4 | Hash passwords |
| websockets | 16.0 | WS native |
| pytest | latest | Tests |
| psycopg2-binary | 2.9.10 | Driver PG (prod) |

## Estructura

```
backend/
├── app/
│   ├── main.py                   # App factory, lifespan, CORS, middleware
│   ├── api/
│   │   ├── auth/                 # Registration, login, activation
│   │   │   ├── routers.py        # /auth/* endpoints
│   │   │   ├── schemas.py
│   │   │   └── dependencies.py
│   │   ├── routers/              # Domain routers
│   │   │   ├── walks.py          # /walks/*
│   │   │   ├── locations.py      # /locations/*
│   │   │   ├── analytics.py      # /analytics/*
│   │   │   ├── sos.py            # /sos/*
│   │   │   ├── groups.py         # /groups/* (owner-only)
│   │   │   └── patient.py        # /patient/*
│   │   ├── websocket/
│   │   │   ├── connection_manager.py  # Single source of truth
│   │   │   ├── websocket_endpoint.py  # /ws/{token}
│   │   │   ├── event_publisher.py     # Pub/sub
│   │   │   └── setup_websocket_events.py
│   │   ├── dependencies/         # Auth deps
│   │   │   ├── auth_deps.py
│   │   │   └── patient_deps.py
│   │   └── deps.py               # get_db, etc.
│   ├── core/
│   │   ├── config/
│   │   │   └── settings.py       # Pydantic Settings
│   │   ├── security/             # JWT, passwords
│   │   │   ├── jwt.py
│   │   │   └── passwords.py
│   │   └── constants.py          # Constants globals
│   ├── db/
│   │   ├── base/base_class.py    # Declarative Base
│   │   ├── session/database.py   # Engine, SessionLocal
│   │   └── models/               # SQLAlchemy models
│   │       ├── user.py
│   │       ├── group.py
│   │       ├── patient.py
│   │       ├── walk.py
│   │       ├── location.py
│   │       └── invitation_code.py
│   ├── services/                 # Business logic
│   │   ├── registration_service.py
│   │   ├── walk_service.py
│   │   ├── location_service.py
│   │   ├── sos_service.py
│   │   └── invitation_service.py
│   └── api/schemas/              # Pydantic request/response
├── tests/                        # pytest
│   ├── conftest.py
│   ├── integration/
│   ├── test_*.py
│   └── test_golden_path_e2e.py
├── scripts/                      # DB migration scripts
├── requirements.txt
├── environment.yml               # micromamba
├── pytest.ini
├── runtime.txt                   # python-3.11.11
└── init_db.py
```

## Auth flow

### Caregiver (web)
1. `POST /auth/register` → crea família + cuidador owner
2. `POST /auth/login` → retorna JWT
3. JWT a `Authorization: Bearer <token>` a totes les peticions
4. JWT payload: `{ user_id, group_id, is_owner, exp }`
5. Secret: `settings.SECRET_KEY` (env var)

### Pacient (device)
1. `POST /auth/activate-device` amb `code` (6 chars) → retorna `device_token` (UUID)
2. `device_token` a `X-Patient-Token: <token>` a totes les peticions
3. Codi d'activació: SHA-256 hashed a DB, expira 2h
4. Token permanent (deute tècnic — SPEC-030)

### Owner guard
```python
@router.post("/groups/sos-toggle")
async def toggle_sos(
    current_user: User = Depends(get_current_caregiver),
    db: Session = Depends(get_db),
):
    if not current_user.is_owner:
        raise HTTPException(403, "Owner only")
    # ...
```

## Dual DB Strategy

**Local dev (SQLite):**
```python
DATABASE_URL=sqlite:///./pathguard.db
```

**Producció (PostgreSQL via Supabase):**
```python
DATABASE_URL=postgresql://postgres.cduokeaobbsdjnckuuxk:...@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

**Connection pooler:** Supavisor (IPv4-compatible). Direct connection és IPv6-only.

**Cross-dialecte:** sempre que usis funcions específiques:

```python
def upsert_location(db, values):
    if 'postgresql' in str(db.bind.url):
        stmt = pg_insert(Location).values(**values)
        stmt = stmt.on_conflict_do_nothing(index_elements=['client_id'])
        db.execute(stmt)
    else:
        # SQLite fallback
        stmt = text("INSERT OR IGNORE INTO locations ...")
        db.execute(stmt, values)
```

## Models

Tots els models a `app/db/models/`. **Regles:**

- `DateTime` sempre amb `timezone=True`
- UUIDs com `String(36)`, mai `UUID(as_uuid=True)` (PG-specific)
- `client_id` com `String(64)` (per SHA-256 hex)
- Foreign keys amb `ondelete` explícit
- Índexs a columnes de cerca freqüent

## WebSocket Pub/Sub

`event_publisher.py` és el cor del sistema:

```python
# Publicar
await event_publisher.publish("location_update", {
    "latitude": 41.5,
    "longitude": 2.2,
    "timestamp": "2026-06-30T...",
    "walk_id": 123,
})

# Subscriure
@event_publisher.subscribe("location_update")
async def broadcast_to_group(event_name, data):
    await connection_manager.broadcast_to_group(group_id, data)
```

**Mai** fer `broadcast` directe des d'un router. Sempre via `event_publisher`.

## Connection Manager (single source of truth)

- `active_connections: dict[str, WebSocket]`
- `_patient_status_store: dict[str, bool]` (instance, no module)
- `last_http_location_at: dict[str, datetime]` (per presència híbrida)
- 4 estats de presència: `online | gps_online | limbo | offline`

## Cache

`backend/app/db/state.py` — `WalkStateCache`:

- En memòria (deute tècnic — no escala multi-worker)
- `latest` + `history` (deque maxlen=200)
- Usat per respostes `GET /walks/{id}/snapshot`

## Testing

```bash
/Users/eduardfarinyes/micromamba/envs/tracker-env/bin/python -m pytest tests/ -v
```

**Baseline:** 152/152 (10 WS timing preexistents — ignorar).

**Tipus de tests:**
- `test_*.py` — funcionals
- `test_active_walk.py` — integration (lifecycle)
- `test_golden_path_e2e.py` — e2e flow
- `test_websocket_*.py` — WS broadcast, isolation

## CORS

```python
ALLOWED_ORIGINS = [
    settings.FRONTEND_URL,        # https://path-guard-orpin.vercel.app
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]

# ⚠️ allow_origins=["*"] NO funciona amb allow_credentials=True
```

## Env vars

| Var | On | Exemple |
|---|---|---|
| `DATABASE_URL` | Render | `postgresql://...` |
| `SECRET_KEY` | Render | random 32+ chars |
| `FRONTEND_URL` | Render | `https://path-guard-orpin.vercel.app` |
| `ADDITIONAL_CORS_ORIGINS` | Render | `https://preview-1.vercel.app,...` |
| `API_V1_STR` | .env | `/api/v1` |
| `PROJECT_NAME` | .env | `PathGuard API` |
