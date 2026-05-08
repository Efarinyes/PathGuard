# PathGuard Project Roadmap

**Last updated:** 2026-05-08
**Current branch:** `develop`
**All phases:** Completed ✅

---

## Overview

| Phase | Status | Priority | Effort |
|-------|--------|----------|--------|
| Phase A: Port Features | ✅ Completed | P0 | 6h |
| Phase B: Technical Debt | ✅ Completed | P1 | 12h |
| Phase C: Architecture | ✅ Completed | P2 | 10h |
| Phase D: PWA Hardening | ✅ Completed | P3 | 6h |

---

## Completed Phases

### Phase A: Port Features ✅
*All simulator features ported to develop*

| Task | Description | Status |
|------|-------------|--------|
| A.1 | Port `is_recovered` column to backend | ✅ |
| A.2 | Port `is_recovered` to schemas and endpoints | ✅ |
| A.3 | Port `BATCH_LOCATION_UPDATE` to WalkEventProcessor | ✅ |
| A.4 | Port segment-based rendering (dashed amber lines) | ✅ |
| A.5 | Port `is_recovered` to frontend transport types | ✅ |
| A.6 | Port Skeleton loading component | ✅ |
| A.7 | Port PWA assets and manifest | ✅ |
| A.8 | Port WebSocket debounce optimization | ✅ |
| A.9 | Port offlineSyncService improvements | ✅ |

### Phase B: Technical Debt ✅
*Technical debt eliminated from develop*

| Task | Description | Status |
|------|-------------|--------|
| B.1 | Consolidate duplicate security code | ✅ |
| B.2 | Delete dead code files | ✅ |
| B.3 | Centralize frontend configuration | ✅ |
| B.4 | Replace deprecated `datetime.utcnow()` | ✅ |
| B.5 | Add missing `__init__.py` files | ✅ |
| B.6 | Eliminate `any` types in frontend (72 instances) | ✅ |
| B.7 | Standardize import paths | ✅ |
| B.8 | Remove duplicate `get_db()` | ✅ |
| B.9 | Remove duplicate `/login` endpoint | ✅ |
| B.10 | Fix inconsistent response shapes | ✅ |
| B.11 | Improve exception handling | ✅ |
| B.12 | Harden SECRET_KEY configuration | ✅ |

### Phase C: Architecture ✅
*Structural improvements*

| Task | Description | Status |
|------|-------------|--------|
| C.1 | Extract service layer from routers | ✅ |
| C.2 | Document WalkStateCache limitations | ✅ |
| C.3 | Database migrations (Alembic) | ⏸️ **Deferred** |

### Phase D: PWA Hardening ✅
*Production hardening for PWA features*

| Task | Description | Status |
|------|-------------|--------|
| D.1 | SW registration conflict fix | ✅ |
| D.2 | Offline fallback page | ✅ |
| D.3 | Sync status API endpoint | ✅ |
| D.4 | Cache-Control headers | ✅ |
| D.5 | PWA error boundary | ✅ |

### Phase D Details

#### D.1: SW Registration Conflict Fix ✅
**File:** `frontend/app/layout.tsx:52-73`
**Problem:** Two service worker registration methods conflict
**Solution:** Keep inline script, make localhost configurable via `.env` (`NEXT_PUBLIC_ENABLE_SW_ON_LOCALHOST`)

#### D.2: Offline Fallback Page ✅
**File:** `frontend/app/offline/page.tsx`
**Content:** "You are offline. Check your connection."
**Added to:** SW precache in `next.config.ts` (`navigateFallback: "/offline"`)

#### D.3: Sync Status API Endpoint ✅
**File:** `backend/app/api/routers/locations.py`
**Endpoint:** `GET /api/v1/locations/sync/status`
**Response:** `{ last_sync: string | null }`
**Use:** Sync progress indicator on client

#### D.4: Cache-Control Headers ✅
**File:** `backend/app/main.py`
**Implementation:** `CacheControlMiddleware`
- `/api/v1/*`: `Cache-Control: no-store`
- Static assets (`.js`, images): `Cache-Control: public, max-age=31536000, immutable`
- Service worker (`pathguard-sw`): `Cache-Control: no-cache`

#### D.5: PWA Error Boundary ✅
**File:** `frontend/components/PWAErrorBoundary.tsx`
**Implementation:** React ErrorBoundary wrapping entire app in `layout.tsx`
- Catches rendering errors
- Shows user-friendly error message with retry option
- Graceful degradation when IndexedDB unavailable

---

## Post-Production Tasks

These tasks will be implemented when certain triggers are met:

### Alembic Migrations (PostgreSQL Required)
**Trigger:** PostgreSQL provisioned + Beta release planned

When to implement (see `ACTION_PLAN.txt` section C.3):
1. PostgreSQL configured and `DATABASE_URL` updated
2. `pip install alembic && alembic init alembic`
3. Create initial migration: `alembic revision --autogenerate -m "initial"`
4. Apply: `alembic upgrade head`
5. Remove `Base.metadata.create_all()` from `main.py`

### Redis Cache (Horizontal Scaling)
**Trigger:** Deployment with multiple gunicorn workers

**Current problem:** `WalkStateCache` is in-memory, not shared between processes
**Solution:** Replace with Redis for shared state

---

## Visual Progress

```
Phase A (Port Features):     [██████████████] 100% ✅
Phase B (Technical Debt):     [██████████████] 100% ✅
Phase C (Architecture):      [██████████████] 100% ✅
Phase D (PWA Hardening):      [██████████████] 100% ✅
```

---

## Tests Status

| Suite | Result |
|-------|--------|
| Backend (pytest) | ✅ 149 passed |
| Frontend (vitest) | ✅ 108 passed / 6 skipped |

**Skipped tests (need fix):** `useLivePatientLocation` tests (A1, A2, B1, B5, C4, D4)
- **Cause:** WalkEventProcessor refactoring changed payload structure
- **Fix:** Update `makeActiveWalkResponse()` mocks in `useLivePatientLocation.test.ts`

---

## Reference Document

For implementation details, see: **`ACTION_PLAN.txt`**

---

*All phases completed - 2026-05-08*