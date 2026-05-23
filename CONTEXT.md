# PathGuard — Project Context

**Last updated:** 2026-05-23  
**Purpose:** Global context document for any AI agent or human developer working on the PathGuard project. Read this before making any changes.

---

## Golden Rules — Non-Negotiable Principles

These principles are **mandatory** and apply to **every line of code** written in this project. They are not aspirational — they are enforced.

### SOLID + Clean Code + Single Responsibility Principle (SRP)
- **One reason to change:** Every function, class, component, and module must have exactly one reason to change.
- **Open/Closed:** Extend behavior through composition and new code, not by modifying existing working code.
- **Zero fetch() in components:** All API calls must go through the `services/` layer. No exceptions.
- **No prop drilling:** Use context, hooks, or composition to avoid passing data through 3+ layers of components.
- **Extract, don't expand:** When a component does 3+ things, extract sub-components. Do not add more responsibilities to an existing component.

### Zero Technical Debt
- **No dead code:** Removed code must not leave imports, references, or commented-out blocks behind.
- **No module-level mutable state:** Mutable state at module scope is prohibited. Use class instances, React state, or context.
- **No `any` types:** TypeScript must be strict. Use `unknown` with type guards if types are uncertain.
- **No console.log in production code:** Use `logger.info()`, `logger.warning()`, `logger.error()` in backend. Use structured logging.
- **No hacks or quick fixes:** If a fix feels like a hack, it is rejected. Solve the root cause.

### Architecture Over Speed
- **Prefer clarity over cleverness:** Code that is easy to read is better than code that is "optimized" but unreadable.
- **Testability first:** If a piece of code is hard to test, its design is wrong.
- **Explicit over implicit:** Prefer explicit imports, explicit types, and explicit state management over magic, globals, or implicit behavior.

**Violating these principles is grounds for immediate rework, regardless of "it works."**

---

## 1. Project Overview

**PathGuard** is a discrete real-time geolocation tracking system designed for caregivers and their dependents (referred to as "familiar" or "persona" in the UI). The product philosophy is:

> *Calm, discreet, reliable — not clinical, not enterprise, not invasive.*

The system consists of:
- A **patient device** (`/patient`) that tracks walks via GPS and can trigger SOS alerts
- A **caregiver dashboard** (`/caregiver`) that monitors the patient in real-time via WebSocket
- An **owner dashboard** (`/caregiver/dashboard`) for group configuration (SOS toggle, activation codes, walk history)

**Current phase:** Post-beta (Phase 4.3 + CSS Design System completed)

---

## 2. Repository Structure

```
PathGuard-project/
├── backend/                    # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/           # Registration, login, activation codes
│   │   │   ├── routers/        # Walks, locations, analytics, SOS, groups
│   │   │   ├── websocket/      # WS endpoints, ConnectionManager, presence
│   │   │   └── dependencies/   # Auth deps (get_current_caregiver, etc.)
│   │   ├── core/               # Settings, security (JWT, passwords)
│   │   ├── db/                 # Models, session, base classes
│   │   ├── main.py             # FastAPI app factory
│   │   └── services/           # Business logic (registration, walk, etc.)
│   ├── tests/                  # pytest suite (152 passing, 10 WS timing pre-existing failures)
│   └── pytest.ini
├── frontend/                   # Next.js 14 (App Router) + React + TypeScript
│   ├── app/                    # Next.js App Router pages
│   │   ├── caregiver/          # /caregiver (monitoring) + /caregiver/dashboard (owner)
│   │   ├── patient/            # /patient (walk controller + SOS)
│   │   ├── activate/           # /activate (device activation)
│   │   ├── register/           # /register (family creation)
│   │   └── page.tsx            # Landing page
│   ├── components/
│   │   ├── CaregiverDashboard/ # Header, layout, analytics, walk history
│   │   ├── CaregiverMap/       # Leaflet map (SSR disabled)
│   │   ├── PatientWalkController/  # Start/stop walk, SOS button
│   │   ├── SOSAlertModal/      # SOS alert modal + sound
│   │   ├── OwnerMenuDrawer.tsx # Owner navigation drawer (new)
│   │   ├── ActivationCodeDisplay.tsx
│   │   ├── SOSToggle.tsx
│   │   └── WalkDetailModal.tsx
│   ├── hooks/                  # React hooks
│   ├── services/               # API service layer
│   ├── lib/                    # Utilities, constants
│   └── tests/                  # Vitest suite (94 passing)
├── docs/                       # Project documentation
│   ├── action-plan.md          # MASTER PLAN — read this first
│   ├── phase4-detailed-plan.md # Detailed Phase 4 breakdown
│   ├── guia-proves-reals.md    # Real-world testing guide
│   └── safari-battery-api-removal.md
├── .audit_archive/             # Product and technical audit reports
│   ├── product_audit.md
│   └── technical_audit.md
├── CHANGELOG.md
├── CONTEXT.md                   # THIS FILE — project context for agents
└── README.md
```

---

## 3. Key Documents (Read in This Order)

| Document | Why It Matters |
|---|---|
| **`docs/action-plan.md`** | **MASTER PLAN.** All phases, audit checkpoints, and verification steps. The single source of truth for what has been done and what remains. |
| **`docs/phase4-detailed-plan.md`** | Detailed breakdown of Phase 4 sub-tasks (4.1–4.5), estimates, risks, and dependencies. |
| **`.audit_archive/product_audit.md`** | 7 product deviations (PD-1–PD-7) and 3 product risks (PR-1–PR-3). All verified aligned. |
| **`.audit_archive/technical_audit.md`** | 3 architectural risks (AR-1–AR-3), 3 tech debt items (TD-1–TD-3), SOLID violations. |
| **`docs/guia-proves-reals.md`** | Real-world testing scenarios (registration, walk lifecycle, SOS, invite). |
| **`frontend/AGENTS.md`** | Next.js-specific rules for this codebase (breaking changes from standard Next.js). |
| **`backend/app/main.py`** | Router registration — the entry point for understanding backend API structure. |

---

## 4. Development Workflow

### Branch Strategy
```
develop (never commit directly)
  └── feat/<feature-name> (work branches)
        → PR → merge to develop → delete branch
```

**Rule:** Never commit to `main` or `develop` directly. Always work in a feature branch.

### Before Committing
1. **Backend tests:** `cd backend && micromamba activate tracker-env && python -m pytest tests/ -v`
2. **Frontend build:** `cd frontend && npm run build --webpack`
3. **Frontend tests:** `cd frontend && npm test`
4. **Live verification** (if applicable): manual test of the changed feature
5. **Only then:** `git add -A && git commit -m "..."`

### Commit Message Style
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Focus on **why**, not what
- Example: `feat: add owner-only walk detail endpoint with scope check`

---

## 5. Backend Specifics

### Environment
- **Python:** 3.11.*
- **Virtual env:** micromamba at `/Users/eduardfarinyes/micromamba/envs/tracker-env/bin`
- **Activation:** `cd backend && micromamba activate tracker-env`
- **Test command:** `/Users/eduardfarinyes/micromamba/envs/tracker-env/bin/python -m pytest tests/ -v`
- **Database:** SQLite (`backend/pathguard.db`, ~90KB with test data)
- **Framework:** FastAPI + SQLAlchemy (ORM) + Pydantic (schemas)

### Architecture Patterns
- **Models:** `app/db/models/` — SQLAlchemy declarative base (`Base` from `app.db.base.base_class`)
- **Routers:** `app/api/routers/` — FastAPI `APIRouter` instances
- **Services:** `app/services/` — Business logic layer (e.g., `registration_service.py`, `walk_service.py`)
- **Dependencies:** `app/api/dependencies/` + `app/api/deps.py` — Auth injection (`get_current_caregiver`, `get_optional_patient`, `resolve_patient`)

### Key Backend Files
| File | Purpose |
|---|---|
| `app/main.py` | App factory, CORS, middleware, router inclusion |
| `app/api/auth/routers.py` | `/auth/*` endpoints (register, login, me, invitation, activation) |
| `app/api/routers/walks.py` | `/walks/*` (start, stop, active, list, detail with owner scope) |
| `app/api/routers/groups.py` | `/groups/*` (SOS toggle, owner-only) |
| `app/api/routers/locations.py` | `/locations/*` (GPS batch ingestion) |
| `app/api/websocket/websocket_endpoint.py` | WebSocket entry point |
| `app/api/websocket/connection_manager.py` | WS room management + presence (merged in Phase 4.2) |
| `app/services/walk_service.py` | Walk lifecycle business logic |

### Auth Model
- **Caregivers:** JWT Bearer token (`Authorization: Bearer <token>`)
- **Patients:** Device token (`X-Patient-Token: <token>`)
- **Ownership:** `User.is_owner` boolean. Only owners can: generate invitations, view activation codes, toggle SOS, view walk details
- **Group isolation:** All data is scoped to `group_id`. Caregivers can only access patients in their group.

### Known Backend Issues
- **10 WebSocket tests fail** due to timing/async issues (pre-existing, unrelated to our changes). These are NOT to be fixed unless explicitly requested.
- **Pydantic deprecation warnings** (class-based `config` → `ConfigDict`). Non-blocking.
- **WebSocket close code 1005** (normal browser close) — now logged as `INFO`, not `WARNING`.

---

## 6. Frontend Specifics

### Environment
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Build:** `npm run build --webpack` (NOT `npm run build` — custom webpack config)
- **Tests:** Vitest (`npm test`)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`)
- **Icons:** Lucide React
- **Map:** Leaflet (dynamically imported, SSR disabled)

### Design System (Tailwind v4 @theme)
All design tokens are defined in `frontend/app/globals.css` via `@theme`. **No `tailwind.config.js`** — it was removed in Phase 4.3. The single source of truth is `@theme`.

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#1E3A8A` | Buttons, links, focus rings, trust color |
| `success` | `#22C55E` | Start walk, SOS confirmed, active states |
| `warning` | `#F59E0B` | Offline, caution states |
| `danger` | `#EF4444` | Stop walk, SOS idle, errors |
| `danger-dark` | `#DC2626` | SOS pressing state |
| `background` | `#F8FAFC` | Page backgrounds, input backgrounds |
| `foreground` | `#0F172A` | Body text, headings |

**Z-index scale:** `z-drawer(40)`, `z-modal(50)`, `z-alert(100)`, `z-sos(200)`

### Architecture Patterns
- **App Router:** `frontend/app/` — File-based routing
- **Components:** `frontend/components/` — Co-located by feature
- **Hooks:** `frontend/hooks/` — Shared logic (`useAppState`, `useOwnerData`, `useLivePatientLocation`)
- **Services:** `frontend/services/` — API abstraction layer (`walkService.ts`, `locationService.ts`)
- **State:** `useAppState.tsx` — React Context + localStorage persistence

### Key Frontend Files
| File | Purpose |
|---|---|
| `app/layout.tsx` | Root layout with `AppStateProvider`, `SOSAlertProvider`, `RoleGuard` |
| `app/globals.css` | Tailwind v4 `@theme` — design token source of truth |
| `app/caregiver/page.tsx` | Caregiver monitoring page |
| `app/caregiver/dashboard/page.tsx` | Owner configuration dashboard |
| `components/CaregiverDashboard/index.tsx` | Main caregiver view (monitoring only) |
| `components/CaregiverDashboard/CaregiverHeader.tsx` | Header with drawer trigger (SRP) |
| `components/OwnerMenuDrawer.tsx` | Navigation drawer (extracted from header) |
| `components/SOSButton/index.tsx` | SOS hold button with progress bar (stable, no layout shift) |
| `hooks/useAppState.tsx` | Global state (tokens, session, walk ID) |
| `hooks/useOwnerData.ts` | Shared hook for `/auth/me` fetching (DRY) |
| `hooks/useLivePatientLocation.ts` | WebSocket message handling + state |
| `hooks/useSOSAlertSound.ts` | Web Audio API chime (440→523→660Hz) |
| `hooks/useWalkSession.ts` | Walk lifecycle hook (start/stop/auto-recovery) |
| `services/walkService.ts` | Walk-related API calls |
| `services/locationService.ts` | Location service (class-based, module-level state eliminated) |
| `lib/wsEventTypes.ts` | WSEventType discriminated union (8 types) |
| `lib/WalkEventProcessor.ts` | Event classification + validation |

### Known Frontend Issues
- **WebSocket reconnect logic** has timing edge cases (pre-existing)
- **Battery monitoring removed entirely** (Safari/iOS incompatibility) — documented in `docs/safari-battery-api-removal.md`

---

## 7. Architectural Decisions & Constraints

### Decisions Already Made
1. **SQLite for beta** — PostgreSQL migration deferred to post-beta
2. **i18n deferred to post-beta** — 165 Catalan strings hardcoded, no translation infrastructure yet. Strategy: cookie-based detection + manual override (see `docs/action-plan.md` 4.5)
3. **No battery monitoring** — Completely removed (not patched) due to Safari/iOS unfixable API incompatibility
4. **Owner-only walk details** — `GET /walks/{id}/locations` requires `is_owner` (implemented in 4.1.2)
5. **SOS sound via Web Audio API** — Synthesized chime, not audio file. Requires `AudioContext.resume()` for autoplay policies
6. **Drawer menu for owner navigation** — Replaces the old flat header. Semi-transparent, animated, non-full-height panel
7. **Tailwind v4 only** — `tailwind.config.js` removed. All design tokens via `@theme` in `globals.css` (single source of truth)
8. **SOS toggle is owner-controlled** — The owner activates SOS from the dashboard. The patient sees the button on next app launch. Real-time sync is deferred (TODO-1)
9. **Design tokens are semantic** — Never use hardcoded hex values in components. Always use `primary`, `success`, `warning`, `danger`, `danger-dark`, `background`, `foreground`

### Constraints
- **SOLID, CleanCode, SRP** — Mandatory. No technical debt accepted.
- **Zero fetch() in components** — All API calls go through `services/` layer
- **No module-level mutable state** — Eliminated in Phase 4.2/4.3
- **No dead code** — Removed code must not leave imports or references
- **Tests must pass** — No regression in existing tests

---

## 8. Common Pitfalls for New Agents

### Backend
- **Do NOT** modify `develop` or `main` directly. Always use feature branches.
- **Do NOT** ignore the 10 pre-existing WS test failures. They are expected.
- **Do NOT** use `print()` — use `logger.info()`, `logger.warning()`, `logger.error()`
- **Do NOT** forget `is_owner` checks on new endpoints
- **Do NOT** create new module-level stores (use class properties instead)

### Frontend
- **Do NOT** use `fetch()` directly in components — always delegate to `services/`
- **Do NOT** add SSR to Leaflet map components — use `dynamic(() => import(...), { ssr: false })`
- **Do NOT** modify `useAppState.tsx` lightly — it's the global state backbone
- **Do NOT** forget the `--webpack` flag in build: `npm run build --webpack`
- **Do NOT** add `any` types — maintain strict TypeScript
- **Do NOT** use hardcoded hex colors (`[#1E3A8A]`, etc.) — use design tokens (`primary`, `success`, `danger`, etc.)
- **Do NOT** create a new `tailwind.config.js` — all tokens live in `globals.css/@theme`

### Both
- **Do NOT** add coverage loss metrics — explicitly prohibited by product audit (PD-7)
- **Do NOT** use clinical/enterprise language in UI strings — follow product philosophy
- **Do NOT** commit without running tests and build first

---

## 9. Agent Onboarding Checklist

Before making ANY change:

- [ ] Read this `CONTEXT.md`
- [ ] Read `docs/action-plan.md` for current phase status **and pending TODOs**
- [ ] Check which branch you're on (`git branch`)
- [ ] Create a feature branch if not already on one
- [ ] Read the relevant audit file in `.audit_archive/` if touching audited areas
- [ ] Run tests BEFORE making changes (baseline)
- [ ] Make changes
- [ ] Run tests AFTER changes
- [ ] Verify build passes
- [ ] Commit only after live verification (if applicable)

---

## 10. Current Phase Status (as of 2026-05-23)

| Phase | Status | Branch |
|---|---|---|
| 1 — Beta Blockers | ✅ Completed | `fix/phase1-beta-blockers` (merged) |
| 2 — Registration/Activation | ✅ Completed | `fix/phase1-beta-blockers` (merged) |
| 3 — Pre-beta Polish | ✅ Completed | `fix/phase3-poliment` (merged) |
| 4.1 — Owner Dashboard | ✅ Completed | `feat/phase4-owner-dashboard` (merged to develop) |
| 4.2 — Backend Architecture | ✅ Completed | `refactor/phase4-architecture` (merged to develop) |
| 4.3 — Frontend Architecture | ✅ Completed | `refactor/phase4-frontend-architecture` (merged to develop) |
| CSS Design System | ✅ Completed | `refactor/css-design-system` (merged to develop) |
| 4.4 — SOS User Test | ⏳ Pending | — |
| 4.5 — i18n | ⏳ Pending | — |
| 5 — Beta Deploy (Vercel + ngrok) | ⏳ Pending | — |

**Completed in this session (v4.3.0):**
- CSS-1: 130+ hex colors migrated to semantic tokens across 20 files
- CSS-2: Vestigial `tailwind.config.js` removed. Tailwind v4 `@theme` is the single source of truth
- CSS-4: CustomIcons.ts keyframes moved to `globals.css`
- CSS-5: PWAErrorBoundary aligned with design system
- CSS-7: Z-index scale defined (`z-drawer`, `z-modal`, `z-alert`, `z-sos`)
- CSS-8: `console.log` removed from production code
- TODO-2: SOS button visual stability fixed (progress bar, fixed height, focus-visible, no pulse)

**Pending TODOs (see `docs/action-plan.md`):**
- TODO-1: SOS Toggle Real-Time — PENDING, a revisar. Flux actual acceptable segons filosofia PathGuard.
- CSS-3: Patrons duplicats (Card, Spinner, ModalOverlay, FormInput) — PENDING post-beta

---

*This document is maintained by the development team. Update it whenever architectural decisions, constraints, or phase statuses change.*