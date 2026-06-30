---
name: pathguard-domain-frontend-stack
description: |
  Detall de l'stack frontend (Next.js 16, React 19, Tailwind v4,
  Capacitor 8). Carregar quan la tasca requereixi saber quines
  versions, configuracions o patrons són vàlids.
metadata:
  triggers:
    - Afegir dependència frontend
    - Decidir entre dues opcions d'implementació
    - Resoldre warning de Next.js 16
  agent_owner: frontend
  prerequisites:
    - pathguard-agent-frontend
---

# Frontend Stack — Detall tècnic

## Versions exactes (v2.6.0-beta.1)

| Component | Versió | Notes |
|---|---|---|
| Next.js | 16.2.4 | App Router. **Breaking changes** vs 14.x. Llegeix `node_modules/next/dist/docs/`. |
| React | 19.2.4 | Server Components estables. `use()` hook. |
| TypeScript | ^5 | Estricte. No `any`. |
| Tailwind CSS | v4 (`@tailwindcss/postcss`) | **Sense `tailwind.config.js`**. Tokens a `globals.css/@theme`. |
| Leaflet | 1.9.4 | Via `react-leaflet` 5.0. **SSR off** (`dynamic(..., { ssr: false })`). |
| Lucide React | ^1.8.0 | Icones. |
| Capacitor | 8.3.4 | Bridge TS → iOS/Android. |
| Vitest | 4.1.5 | Tests. |
| Playwright | 1.59.1 | E2E. |
| fake-indexeddb | 6.2.5 | Mock IndexedDB als tests. |

## ⚠️ Next.js 16 — Breaking Changes

Aquesta versió **no és el Next.js que coneixes**. Llegeix `node_modules/next/dist/docs/` abans d'escriure codi.

Canvis coneguts:
- App Router és l'únic
- Server Components per defecte
- `use()` per promises
- `viewport` i `metadata` com a exports (no `next/head`)
- Nou `dynamic` API
- `params` i `searchParams` són Promise (cal `await` o `use()`)

## Estructura de directoris

```
frontend/
├── app/                          # App Router
│   ├── layout.tsx                # Root: AppStateProvider, SOSAlertProvider, RoleGuard
│   ├── globals.css               # Tailwind v4 @theme (única font de tokens)
│   ├── page.tsx                  # Landing
│   ├── caregiver/
│   │   ├── page.tsx              # Monitoring
│   │   └── dashboard/page.tsx    # Owner dashboard
│   ├── patient/page.tsx          # Walk controller + SOS
│   ├── activate/page.tsx         # Device activation
│   └── register/page.tsx         # Family creation
│
├── components/                   # Co-located per feature
│   ├── CaregiverDashboard/       # Header, layout, analytics, walk history
│   ├── CaregiverMap/             # Leaflet map (SSR disabled)
│   ├── PatientWalkController/    # Start/stop walk + SOS
│   ├── SOSAlertModal/            # SOS alert modal + sound
│   ├── SOSButton/                # Hold button
│   ├── OwnerMenuDrawer.tsx       # Owner nav
│   ├── SOSToggle.tsx
│   ├── ActivationCodeDisplay.tsx
│   ├── WalkDetailModal.tsx
│   ├── LoginForm/                # Co-located
│   ├── RegistrationForm/
│   └── shared/                   # Cross-cutting (Card, Spinner, etc.)
│
├── hooks/                        # Custom hooks
│   ├── useAppState.tsx           # Global state (Context)
│   ├── useLivePatientLocation.ts # WS message handling
│   ├── useLocationTracking.ts    # GPS (web + native bridge)
│   ├── useOfflineRecovery.ts     # Background/foreground
│   ├── useOwnerData.ts           # /auth/me fetching (DRY)
│   ├── useSOSAlert.tsx
│   ├── useSOSAlertSound.ts
│   ├── useWalkSession.ts         # Walk lifecycle
│   └── useWebSocket.ts
│
├── services/                     # API service layer
│   ├── walkService.ts
│   ├── locationService.ts        # Class-based, no module state
│   ├── offlineSyncService.ts     # IndexedDB
│   ├── gpsTransportService.ts
│   ├── patientService.ts
│   └── trajectoryService.ts
│
├── lib/                          # Utilities
│   ├── config.ts                 # Constants (GPS intervals, URLs)
│   ├── wsEventTypes.ts           # WSEventType discriminated union (8 tipus)
│   ├── WalkEventProcessor.ts     # Event validation + state reduction
│   ├── locationId.ts             # SHA-256 deterministic ID
│   ├── gpsUtils.ts               # Haversine, speed
│   ├── formatTimeAgo.ts
│   └── swRegistration.tsx
│
├── tests/
│   ├── e2e/                      # Playwright
│   └── integration/              # Vitest + Testing Library
│
├── public/                       # Assets, manifest.json, sw.js
│
├── plugins/
│   └── location-sync/            # Capacitor plugin
│       ├── src/index.ts          # TS bridge (contracte)
│       ├── android/              # Java plugin
│       └── ios/                  # Swift plugin
│
├── android/                      # Android native project
├── ios/                          # iOS native project
│
├── capacitor.config.ts
├── next.config.ts
├── tailwind (vía @theme a globals.css)
├── vitest.config.ts
├── tsconfig.json
├── package.json                  # v2.6.0-beta.1
└── README.md
```

## Design System (Tailwind v4 @theme)

A `app/globals.css`:

```css
@theme {
  --color-primary: #1E3A8A;
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-danger-dark: #DC2626;
  --color-background: #F8FAFC;
  --color-foreground: #0F172A;
  
  --z-drawer: 40;
  --z-modal: 50;
  --z-alert: 100;
  --z-sos: 200;
}
```

**Regles:**
- Mai hex hardcoded (`#1E3A8A`) en components
- Sempre tokens semàntics (`bg-primary`, `text-danger`)
- Variants d'opacitat: `shadow-primary/10`

## API Service Layer Pattern

```typescript
// services/walkService.ts
class WalkService {
  async startWalk(walkId: number, deviceToken: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/walks/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Patient-Token': deviceToken,
      },
    });
    if (!response.ok) throw new StartWalkError(response.status);
  }
  
  async stopWalk(walkId: number, deviceToken: string): Promise<void> { ... }
}

export const walkService = new WalkService();
```

**Regles:**
- Mai `fetch()` en component
- Sempre via service
- Tokens injectats des del caller (no globals)
- Errors tipats

## State Management

- **Global:** `useAppState` (Context + localStorage persistence)
- **Local:** `useState` per UI state
- **WebSocket:** `useReducer` + `WalkEventProcessor` (state machine)
- **Cap Redux, cap Zustand** — overkill per aquest projecte

## PWA

- Service Worker generat per `@ducanh2912/next-pwa` v10.2.9
- `webDir: 'public'` (no `out`)
- Manifest a `public/manifest.json`
- **API calls:** NetworkOnly (mai cachejar)
- **Assets:** CacheFirst amb max-age 1 any

## Build & Deploy

```bash
# Local dev
npm run dev            # next dev --webpack (port 3000)

# Build
npm run build --webpack  # ⚠️ flag --webpack obligatori

# Test
npm test               # vitest run

# Deploy (auto via Vercel hook)
git push origin main   # Vercel detecta i desplega
```

## Variables d'entorn

| Var | On | Exemple |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel + .env.local | `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_WS_URL` | Vercel + .env.local | `ws://localhost:8000/api/v1/ws` |

Mai commitejar `.env.local`.
