<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Frontend Agent — Quick reference

Aquest fitxer és la **porta d'entrada** al frontend. La informació detallada és als skills.

## Carrega a l'inici de cada sessió

| Skill | Quan |
|---|---|
| `.opencode/skills/pathguard-core-state/SKILL.md` | **SEMPRE** primer |
| `.opencode/skills/pathguard-agent-frontend/SKILL.md` | Sempre (el teu rol) |
| `.opencode/skills/pathguard-domain-frontend-stack/SKILL.md` | Quan necessitis detalls d'stack |

## Regles d'or del projecte

Veure `CONTEXT.md` (golden rules) i `.opencode/skills/pathguard-core-golden-rules/SKILL.md`.

## Errors comuns a evitar

- ❌ `fetch()` directe en components
- ❌ `any` per evitar tipus
- ❌ Hex hardcoded (`#1E3A8A`) — usa tokens (`primary`, `success`, etc.)
- ❌ SSR en components Leaflet
- ❌ Build sense `--webpack` (`npm run build --webpack`)
- ❌ Modificar `frontend/plugins/location-sync/src/index.ts` (és del Platform Integration)

## Stack actual

- Next.js **16.2.4** (App Router)
- React **19.2.4**
- TypeScript **^5** (estricte)
- Tailwind **v4** (`@tailwindcss/postcss`, sense `tailwind.config.js`)
- Leaflet **1.9.4** (via `react-leaflet` 5.x, SSR off)
- Capacitor **8.3.4**

⚠️ **Next.js 16** té breaking changes respecte a 14.x. Llegeix `node_modules/next/dist/docs/` abans de qualsevol cosa.

## Tests

```bash
npm test                  # Vitest
npm run build --webpack   # Build
npx playwright test       # E2E
```

**Baseline:** 108/108 (6 skipped preexistents). Cap regressió.

## Quan tens dubtes

1. Carrega `pathguard-core-state` (saber on som)
2. Llegeix el skill del teu rol (`.opencode/skills/pathguard-agent-frontend/SKILL.md`)
3. Si la tasca és SDD, carrega el skill de workflow corresponent
4. Si encara tens dubtes, pregunta al Tech Lead (no inventis)
