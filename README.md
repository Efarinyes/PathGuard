# PathGuard

> *Discreet real-time geolocation for caregivers and their dependents.*
> *Calm, discreet, reliable — not clinical, not enterprise, not invasive.*

**Version:** v2.6.0-pwa-stable.0
**Status:** Pre-beta — fully functional PWA with known limitations.

---

## What is PathGuard?

PathGuard allows a caregiver to see the location of a family member (the "patient") during walks in real time. The patient carries a device with a simple screen: start walk, stop walk, SOS button. The caregiver sees the walk route on a map, receives SOS alerts, and can review walk history.

It is designed to feel warm and familiar, not clinical or invasive. The patient controls when tracking starts and stops. The caregiver watches, but cannot activate tracking remotely.

---

## Current State — v2.6.0-pwa-stable

This release marks the last fully **PWA-based** version of PathGuard. Everything works as a Progressive Web App (installable on both iOS and Android via browser).

### ✅ What works

| Feature | Status | Notes |
|---------|--------|-------|
| Family registration (owner + patient + group) | ✅ | Creates activation code for the patient device |
| Device activation (`/activate`) | ✅ | Enter code on patient device to link it |
| Walk lifecycle (start / stop) | ✅ | Patient controls when a walk begins and ends |
| Real-time GPS tracking via WebSocket | ✅ | Caregiver sees route on the map in real time |
| SOS alert (3s press-and-hold) | ✅ | Chime sounds on caregiver dashboard, modal with confirmation |
| Caregiver monitoring dashboard | ✅ | Real-time map, patient status, SOS alert |
| Owner dashboard (`/caregiver/dashboard`) | ✅ | SOS toggle, activation code, invitation code, caregiver list |
| Walk history + analytics | ✅ | Duration, timeline, activity analytics |
| PostgreSQL persistence | ✅ | Supabase managed DB — data survives restarts |
| SHA-256 hashing for activation codes | ✅ | Codes stored hashed, 2h expiry |
| Adaptive GPS intervals | ✅ | 15s walking / 30s normal / 2min idle (reduced battery usage) |
| Drawer navigation (owner) | ✅ | 3-route navigation: monitoring, config, activity |

### ❌ Known limitations (why native is needed)

| Limitation | Root cause | Impact | Solution planned |
|------------|-----------|--------|-----------------|
| **False offline after backgrounding** | iOS PWA stops WebSocket + GPS when screen locks or app goes to background. After a few minutes, the backend declares `patient_offline` even though the patient is still walking. | Caregiver sees "offline" alerts during active walks. Breaks trust in the system. | **Native app** via Capacitor for `/patient` — GPS and WebSocket stay alive in background |
| **No push notifications** | PWA cannot receive push events when browser is closed. | SOS is only received if caregiver has dashboard open. | Web Push API or native push (post-beta) |
| **No GPS in background (iOS)** | Safari does not support the Geolocation API in background. | Route has gaps when phone is in pocket with screen off. | `@capacitor/geolocation` with background permissions |
| **Battery monitoring removed** | Safari/iOS incompatible API. | Feature dropped completely. | Not planned to restore |

---

## Roadmap — Beyond PWA

We are evolving `/patient` from a PWA to a **native app** (via Capacitor) while keeping `/caregiver` and all other routes as a PWA.

```
[Patient]                  [Caregiver]
   │                           │
   ▼                           ▼
Capacitor app               PWA (unchanged)
(native GPS + WS            (browser/smartphone/desktop)
 in background)
   │                           │
   └─────── WebSocket ─────────┘
               │
               ▼
        FastAPI backend
               │
               ▼
        Supabase PostgreSQL
```

| Step | What | When |
|------|------|------|
| ⏳ **E** | Capacitor for `/patient` (native GPS, persistent WS) | Next |
| ⏳ **4.4** | SOS user test | After E |
| ⏳ **5** | Beta deploy checklist | After 4.4 |
| ⏳ **4.5** | i18n (Catalan, Spanish) | Post-beta |
| 🔮 **Future** | Web Push notifications, Capacitor for caregiver | Post-beta |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 (`@theme` tokens) |
| Map | Leaflet (SSR-disabled, dynamic import) |
| Icons | Lucide React |
| Backend | FastAPI (Python 3.11) |
| ORM | SQLAlchemy |
| Validation | Pydantic v2 |
| Database | **SQLite** (local dev) / **PostgreSQL** via Supabase (production) |
| Real-time | WebSockets (pub/sub event system) |
| Auth | JWT (caregiver) + device token (patient) |
| PWA | Service worker (Workbox via `@ducanh2912/next-pwa`) |
| Hosting | **Vercel** (frontend) + **Render** (backend) + **Supabase** (DB) |

---

## Run Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Micromamba / Conda (recommended for backend)

### Backend
```bash
cd backend
micromamba activate tracker-env
python -m uvicorn app.main:app --reload --port 8000
```
API docs: `http://localhost:8000/docs`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App: `http://localhost:3000`

### Tests
```bash
# Backend (152 passing, 10 pre-existing WS timing failures)
cd backend && python -m pytest tests/ -v

# Frontend (108 passing, 6 skipped)
cd frontend && npm test

# Build verification
cd frontend && npm run build --webpack
```

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `FRONTEND_URL` | Render / `.env` | CORS origin |
| `SECRET_KEY` | Render / `.env` | JWT signing |
| `DATABASE_URL` | Render / `.env` | PostgreSQL connection (omit for SQLite dev) |
| `NEXT_PUBLIC_API_URL` | Vercel | Backend API URL |
| `NEXT_PUBLIC_WS_URL` | Vercel | WebSocket URL |

---

## Git Workflow

```
main ── develop ── feat/* or fix/* (work branches)
```

- **`main`** — Production. Deploys automatically to Vercel + Render.
- **`develop`** — Integration branch. Feature branches merge here first.
- **`release/*`** — Release snapshots. `release/v2.6.0-pwa-stable` is the last PWA-only version.

---

## References

- `docs/action-plan.md` — Consolidated plan with phases, checkpoints, and pending items
- `docs/PRIMERA-APROXIMACIO-CAP-A-BETA-ESTABLE.md` — Product roadmap and decisions
- `docs/FASE-G-POSTGRESQL-MIGRATION.md` — PostgreSQL migration plan
- `.audit_archive/product_audit.md` — Product audit deviations
- `.audit_archive/technical_audit.md` — Technical audit risks

---

*PathGuard Family Safety Project — Developed for calm, discreet, reliable care.*
