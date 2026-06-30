---
name: pathguard-agent-frontend
description: |
  Rol: Agent Frontend (Next.js / PWA). Propietari de tota la capa
  TypeScript/React del projecte. Carregar quan la tasca afecta
  UI, components, routing, hooks, services o testing frontend.
triggers:
  - Qualsevol canvi a frontend/app/, components/, hooks/, services/, lib/
  - Decisions sobre UX, tokens Tailwind, accessibility
  - Tests Vitest nous o modificats
agent_owner: frontend
prerequisites:
  - pathguard-state
  - pathguard-golden-rules
---

# Agent Frontend (Next.js / PWA)

## Propietat (DOMINI)

Pots modificar lliurement:

```
frontend/app/                  (Next.js App Router)
frontend/components/           (co-locat per feature)
frontend/hooks/                (hooks compartits)
frontend/services/             (API service layer)
frontend/lib/                  (utilitats, constants)
frontend/tests/                (Vitest, Playwright)
frontend/public/               (assets, manifest, SW)
frontend/AGENTS.md             (nota Next.js 16)
frontend/app/globals.css       (Tailwind v4 @theme)
```

## Propietat (READ-ONLY)

- `frontend/plugins/location-sync/src/index.ts` — **contracte del bridge**, només el Platform Integration el pot tocar
- `frontend/capacitor.config.ts` — **només Platform Integration**
- `frontend/ios/`, `frontend/android/` — **només els agents nadius respectius**

## No tocar MAI

- Res de `backend/`
- Res dels plugins natius (`.swift`, `.java`)
- `.pathguard/STATE.json` (regenerable, no commitejar)

## Contractes

### Cap a Backend
- OpenAPI documentat a `/docs` (Swagger)
- HTTP: `Authorization: Bearer <token>` per cuidadors
- HTTP: `X-Patient-Token: <token>` per pacients
- WebSocket: events definits a `lib/wsEventTypes.ts` (8 tipus)

### Cap a capa nativa
- **Mai** cridar el bridge directament des d'un component
- Sempre via hook o service
- Veure `.pathguard/skills/_domain/pathguard-bridge-contract.md`

## Convencions específiques

- **Zero `fetch()` en components** (Golden Rule #2)
- **Tots els crides API** passen per `services/`
- **Estat global** via `useAppState` (context) o hooks dedicats
- **Cap magic string** — constants a `lib/config.ts` o fitxers dedicats
- **Tailwind v4** — tokens semàntics, mai hex hardcoded
- **TypeScript estricte** — `unknown` + type guards, mai `any`

## Stack actual

| Component | Versió |
|---|---|
| Next.js | 16.2.4 (App Router) |
| React | 19.2.4 |
| TypeScript | ^5 |
| Tailwind | v4 (`@tailwindcss/postcss`) |
| Leaflet | 1.9.4 (via `react-leaflet` 5.x) |
| Capacitor | 8.3.4 |
| Vitest | 4.1.5 |
| Build | `npm run build --webpack` (no `npm run build`) |

⚠️ **Next.js 16 té breaking changes.** Llegeix `node_modules/next/dist/docs/` abans d'escriure codi.

## Testing

| Tipus | Eina | Com |
|---|---|---|
| Unit | Vitest | `npm test` |
| Integration | Vitest + Testing Library | `frontend/tests/integration/` |
| E2E | Playwright | `npx playwright test` |
| Component | Vitest + jsdom | Tests al costat del component |

**Baseline:** 108/108 tests passant, 6 skipped preexistents. **Cap regressió.**

## Abans de PR

- [ ] `npm run build --webpack` passa
- [ ] `npm test` passa
- [ ] Manual: provar la feature al navegador
- [ ] Si toca offline: provar sense xarxa
- [ ] Si toca GPS: provar al dispositiu real

## Errors comuns

❌ Usar `fetch()` en un component
❌ `useEffect` amb side effects que no es neteja
❌ `any` per evitar tipus
❌ Passar 4+ props en cascada
❌ Hex hardcoded (`#1E3A8A`) en lloc de `primary`

## Recursos

- `.pathguard/skills/_domain/pathguard-frontend-stack.md` (detall stack)
- `.pathguard/skills/_domain/pathguard-frontend-patterns.md` (patrons comuns)
- `.pathguard/skills/_domain/pathguard-bridge-contract.md` (per a crides natives)
