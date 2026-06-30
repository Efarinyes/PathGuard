# PathGuard — Visió Arquitectònica

## Filosofia

> *Calm, discreet, reliable — not clinical, not enterprise, not invasive.*

Aquest principi guia totes les decisions arquitectòniques. Si una decisió el viola, és incorrecta.

## Capes

```
┌─────────────────────────────────────────────────────────────┐
│  Pacient (PWA mòbil)              Cuidador (web/escriptori)│
│  ┌─────────────┐                   ┌─────────────────────┐ │
│  │ Next.js 16  │                   │ Next.js 16 (App     │ │
│  │ (PWA)       │                   │   Router)           │ │
│  └──────┬──────┘                   └──────────┬──────────┘ │
└─────────┼─────────────────────────────────────┼────────────┘
          │ Capacitor Bridge                    │ HTTPS / WSS
          │                                     │
          ▼                                     ▼
┌──────────────────────┐         ┌─────────────────────────────┐
│ Native Layer         │         │ Backend                     │
│ ┌──────────────────┐ │         │ ┌─────────────────────────┐ │
│ │ Android Plugin   │ │         │ │ FastAPI                 │ │
│ │ (Java)           │ │  HTTPS  │ │ - Auth (JWT + device)   │ │
│ │ - LocationSync   │ ├────────►│ │ - WebSockets            │ │
│ │ - FusedLocation  │ │         │ │ - REST API              │ │
│ └──────────────────┘ │         │ │ - Event Publisher       │ │
│ ┌──────────────────┐ │         │ └────────────┬────────────┘ │
│ │ iOS Plugin       │ │         └──────────────┼──────────────┘
│ │ (Swift)          │ │                        │
│ │ - LocationSync   │ │                        │ asyncpg
│ │ - CLLocation     │ │                        ▼
│ └──────────────────┘ │         ┌─────────────────────────────┐
└──────────────────────┘         │ Supabase PostgreSQL        │
                                 │ (Supavisor pooler IPv4)    │
                                 └─────────────────────────────┘
```

## Stack resumit

| Capa | Tecnologia | Versió |
|---|---|---|
| Frontend | Next.js + React + TypeScript | 16.2.4 + 19.2.4 |
| Styling | Tailwind CSS | v4 (`@theme`) |
| Mapes | Leaflet + react-leaflet | 1.9.4 + 5.x |
| Backend | FastAPI + SQLAlchemy + Pydantic | 0.136 + 2.0 + 2.13 |
| Real-time | WebSockets + Pub/Sub | (websockets 16.0) |
| Database (dev) | SQLite | — |
| Database (prod) | PostgreSQL via Supabase | — |
| Native (Android) | Java + ForegroundService | — |
| Native (iOS) | Swift + CLLocationManager | — |
| Bridge | Capacitor | 8.3.4 |
| PWA | @ducanh2912/next-pwa | 10.2.9 |
| Tests BE | pytest | latest |
| Tests FE | Vitest + Playwright | 4.1.5 + 1.59.1 |
| Deploy FE | Vercel | — |
| Deploy BE | Render | — |

## Fluxos principals

### 1. Registre i activació

```
Cuidador (web)                 Pacient (PWA nadiu)
─────────────────              ───────────────────
POST /auth/register     →      (cap acció)
  → Rep activation_code
  → Mostra codi a la UI
                              Entra codi a /activate
                              POST /auth/activate-device
                                → Rep device_token
                                → Guarda a useAppState
                              Redirigeix a /patient
```

### 2. Walk actiu (cas ideal)

```
Pacient (PWA)                              Cuidador (web)
─────────────                              ───────────────
[Start walk]
POST /walks/start
  (X-Patient-Token)
  ← walk_id
                              ← WS: walk_started

Loop:
  LocationAcquirer (natiu)     → POST /locations/batch (cada 2s)
  ↓ filter gates
  LocationBuffer
  ↓ flush on-demand
  → HTTP POST
  ↓ backend upsert
  → Event Publisher
                              ← WS: location_update (broadcast)
                              ↓
                              MapRenderer rep punt
                              Pintat en verd (live)
```

### 3. Pèrdua de cobertura

```
Pacient (PWA)                              Cuidador (web)
─────────────                              ───────────────
[mode avió]
LocationHttpClient.sendBatch → fail
  ↓ onFlushResult(false)
LocationBuffer
  → recoveryStreak++
  → isRecovered=true per nous punts
  → save() a SharedPreferences
                              WS mor
                              ↓
                              caregiver veu:
                              "Reconnectant..." (limbo)
                              NO "offline" (vermell)

[mode avió OFF]
Nou LocationHttpClient.sendBatch → success
  ↓ onFlushResult(true)
LocationBuffer
  → isRecovered=true (ja marcats)
  → persisteix
                              ← WS: location_update (reconnecta)
                              ↓
                              MapRenderer rep batch recovered
                              Pintat en taronja (recovered)
```

### 4. SOS

```
Pacient (PWA)                              Cuidador (web)
─────────────                              ───────────────
[hold SOS 3s]
  ↓ SOUND not played locally
  ↓ POST /sos/trigger (HTTP + WS)
                              ← WS: sos_alert
                              ↓
                              useSOSAlertSound.playChime()
                              ↓
                              SOSAlertModal.render()
                              ↓
                              Cuidador veu mapa amb posició SOS
```

## Components clau

### Backend

- **FastAPI app** (`backend/app/main.py`) — factory + CORS + middleware
- **Routers** (`backend/app/api/routers/`) — auth, walks, locations, etc.
- **Services** (`backend/app/services/`) — lògica de negoci
- **Models** (`backend/app/db/models/`) — SQLAlchemy
- **WebSocket** (`backend/app/api/websocket/`) — connection_manager, event_publisher
- **Auth** (`backend/app/core/security/`) — JWT, passwords

### Frontend

- **App Router** (`frontend/app/`) — pages
- **Components** (`frontend/components/`) — co-located per feature
- **Hooks** (`frontend/hooks/`) — composició
- **Services** (`frontend/services/`) — API layer
- **Lib** (`frontend/lib/`) — utils + constants
- **Plugins** (`frontend/plugins/location-sync/`) — Capacitor plugin

### Native

- **Android** (`frontend/plugins/location-sync/android/`) — Java plugin
- **iOS** (`frontend/plugins/location-sync/ios/`) — Swift plugin

## Decissions arquitectòniques rellevants

Veure [`decisions/`](decisions/) per ADRs formals.

| Decisió | Resum | ADR |
|---|---|---|
| Dual DB (SQLite dev, PG prod) | Mateix codi, dialegts diferenciats | 0001 |
| Capacitor sobre React Native | PWA + nadiu, una sola codebase | 0002 |
| Capacitor Swift PM | No CocoaPods | 0003 |
| WebSocket Pub/Sub | event_publisher com a bus | 0004 |
| SHA-256 client_id | Idempotència a backend | 0005 |
| (pendent) 1 font GPS | Plugin only, no Geolocation fallback | — |
| (pendent) Tokens a Capacitor Preferences | No localStorage en natiu | — |

## Tests baseline

| Capa | Baseline | Excepcions |
|---|---|---|
| Backend | 152/152 | 10 WS timing preexistents |
| Frontend | 108/108 | 6 skipped preexistents |
| Android | 0/0 | Deute tècnic |
| iOS | 0/0 | Deute tècnic |

## Referències

- [`../CONTEXT.md`](../../CONTEXT.md) — Golden rules
- [`../specs/000-index.md`](../../specs/000-index.md) — Catàleg de specs
- [`../agents/INDEX.md`](../../agents/INDEX.md) — Agents i skills
- [`decisions/`](decisions/) — ADRs
