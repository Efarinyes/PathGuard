---
name: pathguard-agent-backend
description: |
  Rol: Agent Backend (FastAPI). Propietari de tota la capa Python
  del projecte. Carregar quan la tasca afecta API, models,
  serveis, autenticació, persistència o tests backend.
metadata:
  triggers:
    - Qualsevol canvi a backend/app/
    - Nous endpoints, models, schemas
    - Decisions sobre auth, group isolation, WebSocket
    - Tests pytest nous o modificats
  agent_owner: backend
  prerequisites:
    - pathguard-state
    - pathguard-golden-rules
---

# Agent Backend (FastAPI)

## Propietat (DOMINI)

Pots modificar lliurement:

```
backend/app/                   (FastAPI app, routers, services)
backend/tests/                 (pytest)
backend/scripts/               (migracions, scripts DB)
backend/requirements.txt
backend/environment.yml
backend/pytest.ini
```

## Propietat (READ-ONLY)

- `.env`, secrets — **només DevOps**
- `backend/pathguard.db` (SQLite dev) — **gitignored**

## No tocar MAI

- Res de `frontend/`
- Res de `frontend/plugins/location-sync/` (és JS, no Python)
- `backend/.env` (secret)

## Contractes

### Cap a Frontend
- OpenAPI: serveit a `/{API_V1_STR}/openapi.json` i Swagger `/docs`
- Auth cuidador: `Authorization: Bearer <jwt>` (HS256, secret a `settings.SECRET_KEY`)
- Auth pacient: `X-Patient-Token: <uuid>`
- WebSocket: `/{API_V1_STR}/ws/`
- Errors: HTTP status + JSON `{ "detail": "..." }`

### Cap a capa nativa
- **Endpoints GPS**: `POST /locations/batch` rep el payload del plugin
- Format: `{ walk_id, batch_id, points: [{ latitude, longitude, timestamp, client_id, is_recovered }] }`
- Validacions: rang lat/lng, idempotència via `client_id` (SHA-256, 64 chars)

## Models de dades

| Model | Taula | Notes |
|---|---|---|
| `User` | `users` | JWT auth, `is_owner` boolean |
| `Group` | `groups` | Aïllament de dades |
| `Patient` | `patients` | `device_token`, `activation_code_hash` (SHA-256, 2h expiry) |
| `Walk` | `walks` | `started_at`, `ended_at`, `started_by_user_id` |
| `Location` | `locations` | `client_id` (VARCHAR 64), `is_recovered`, `low_confidence` |
| `InvitationCode` | `invitation_codes` | `code` (VARCHAR 64, SHA-256) |

**Regles:**
- Tots els `DateTime` amb `timezone=True`
- UUIDs com `String(36)` (no `UUID` PG-specific — AR-3 audit)
- `client_id` com `String(64)` (per SHA-256 hex)

## Stack actual

| Component | Versió |
|---|---|
| Python | 3.11.* |
| FastAPI | 0.136.0 |
| SQLAlchemy | 2.0.49 |
| Pydantic | 2.13.2 |
| Alembic | (no usat actualment) |
| pytest | latest |
| Database | SQLite (dev) + PostgreSQL (prod via Supabase) |

## Dual DB strategy

- **Dev local:** SQLite a `backend/pathguard.db` (`DATABASE_URL=sqlite:///./pathguard.db`)
- **Producció:** PostgreSQL a Supabase via Supavisor pooler (IPv4)
- **Tests:** SQLite in-memory

**Validació cross-dialecte:** si uses funcions específiques de PostgreSQL, fes fallback per SQLite (`if 'postgresql' in str(db.bind.url): ...`).

## Testing

| Tipus | Eina | Com |
|---|---|---|
| Unit | pytest | `pytest tests/integration/ -v` |
| Integration | pytest + TestClient | `pytest tests/test_active_walk.py -v` |
| Auth | pytest | `pytest tests/test_auth.py -v` |
| E2E golden path | pytest | `pytest tests/test_golden_path_e2e.py -v` |

**Test command:**
```bash
/Users/eduardfarinyes/micromamba/envs/tracker-env/bin/python -m pytest tests/ -v
```

**Baseline:** 152/152 (10 WS timing preexistents — ignorar). **Cap regressió.**

## Abans de PR

- [ ] `pytest tests/ -v` passa
- [ ] `openapi.json` regenerat i coherent
- [ ] Si toca auth: verificar `is_owner` checks
- [ ] Si toca DB: verificar compatibilitat SQLite + PostgreSQL
- [ ] Si toca WebSocket: verificar que el broadcast arriba a tots els cuidadors del grup

## Errors comuns

❌ Usar `print()` en lloc de `logger`
❌ `UUID(as_uuid=True)` (PG-specific) en comptes de `String(36)`
❌ Crear nou module-level store (usar class instance o `connection_manager`)
❌ Oblidar `is_owner` check en endpoint owner-only
❌ Oblidar validar rang de lat/lng
❌ Commit directe a `develop`

## Recursos

- `.pathguard/skills/_domain/pathguard-backend-stack.md` (detall stack)
- `.pathguard/skills/_domain/pathguard-backend-models.md` (models, camps, regles)
- `.pathguard/skills/_domain/pathguard-backend-ws-events.md` (esquema WS events)
