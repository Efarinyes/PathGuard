# PathGuard

Family safety app for real-time walk monitoring. Calm, discreet, reliable.

## Philosophy

PathGuard helps caregivers watch over elderly relatives during walks. The product must feel warm, not clinical. It must be discrete, not invasive. It must be reliable, not overwhelming.

- **Calm**: The SOS sound is a warm chime, not a fire alarm. The patient screen has one button. No analytics noise during active monitoring.
- **Discreet**: No watcher counts, no incident logs, no cumulative SOS counters. The caregiver knows their relative is safe — that's it.
- **Reliable**: Offline-first sync, adaptive GPS, WebSocket rehydration. No pause monitoring button. If a walk is active, we are watching.

## Current Status

**Pre-beta audit complete. Applying improvements before first external user.**

See `docs/action-plan.md` for the full improvement plan organized by phase:
- **Phase 1**: Beta blockers (delete dead code, fix SOS sound, clean UI)
- **Phase 2**: Patient activation flow (activation code instead of registration checkbox)
- **Phase 3**: Pre-beta polish (language, dead code removal)
- **Phase 4**: Post-beta (owner dashboard, architecture cleanup)

## Get Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Micromamba/Conda (recommended for backend)

### Backend (FastAPI)

```bash
cd backend
micromamba env create -f environment.yml
micromamba activate tracker-env
python init_db.py
python -m uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:3000`

### E2E Tests (Playwright)

```bash
cd frontend
npx playwright test
```

## Architecture

| Layer | Stack |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS v4, Lucide Icons |
| Backend | FastAPI, SQLAlchemy (SQLite dev / PostgreSQL prod), Pydantic v2 |
| Real-time | WebSockets with pub/sub event system |
| PWA | Service worker with offline-first sync (IndexedDB) |
| State | Custom React hooks + LocalStorage persistence |

## Core Flows

**Registration**: Owner creates family group + patient + caregiver account. Receives an activation code for the patient device.

**Patient activation**: Separate `/activate` route — enter the code, device is linked, land on the walk screen. One button.

**Caregiver monitoring**: Real-time map, walk history, device status. Analytics available on-demand from owner dashboard only.

## Battery Monitoring Compatibility

- Supported: Android (Chrome, Edge), Desktop (Chrome, Edge, Brave)
- Unsupported: iOS/iPadOS (all browsers), Desktop (Safari, Firefox)

## References

- `docs/action-plan.md` — Consolidated improvement plan with audit checkpoints

---

*Developed for the PathGuard Family Safety Project.*