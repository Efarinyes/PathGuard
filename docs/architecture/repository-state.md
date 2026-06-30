# PathGuard — Estat del repositori

**Última actualització:** 2026-06-30 (post-Fase 0)

## Branques oficials

| Branca | Propòsit | Qui hi commita | Merge cap a |
|---|---|---|---|
| `main` | Producció. **Vercel i Render hi deployen.** | Ningú directe (només merge des de `develop` o release tags) | — |
| `develop` | Integració. Branca d'estabilitat. | Tech Lead, agents amb PR | `main` via release |
| `feat/*` | Nova funcionalitat | Agent del domini | `develop` |
| `fix/*` | Correcció de bug | Agent del domini | `develop` |
| `refactor/*` | Refactorització | Agent del domini | `develop` |
| `docs/*` | Canvis de documentació | Tothom | `develop` |
| `release/*` | Branca de snapshot | Tech Lead | `main` + `develop` |

## ⚠️ Regla d'or

**`main` NO ES TOCA directament.** Tots els canvis van via PR des de `develop`. Excepció: hotfixos crítics (rar), sempre via PR.

## Branques locals actives (post-neteja Fase 0)

| Branca | Estat | Última acció coneguda |
|---|---|---|
| `main` | ✅ Al dia | Deployat a prod |
| `develop` | ✅ Al dia | Últim merge de develop |
| `feat/ios-native-layer` | 🔄 En treball | Capa iOS provisional, plugin trencat (veure SPEC-010) |
| `refactor/fase-0-structural-restructuring` | 🔄 En treball | Fase 0 (Fase 0 canvis estructurals) |

## Tags

### Mantenim

| Tag | Commit | Descripció |
|---|---|---|
| `v2.6.0-beta.1` | (post-Phase G) | Versió post-Phase G (PostgreSQL via Supabase) |
| `v2.6.0-beta.3` | `f03e7ec` | Merge a main del plugin actualitzat |
| `v2.6.0-pwa.0` | `e521835` | Snapshot PWA pura (pre-Capacitor) |

### Esborrats a la neteja Fase 0

- `archive/pre-audit-v2.5.0-beta.1`
- `audit-baseline-2026-05-11`
- `baseline-stable-e2e-pass`
- `phase1-stable`
- `phase2-stable`
- `phase2-stable-refactor`
- `v0.3.0-beta`
- `v4.3.0` ← **sospitós**, semver trencat

## Remots

| Remot | URL |
|---|---|
| `origin` | `git@github.com:Efarinyes/PathGuard.git` |

## Deploy actual

| Plataforma | Què serveix | Branca/Tag |
|---|---|---|
| **Vercel** (frontend PWA) | `https://path-guard-orpin.vercel.app` | `main` |
| **Render** (backend FastAPI) | `https://pathguard-sjxy.onrender.com` | `main` |
| **Supabase** (PostgreSQL) | `eu-west-1, ref cduokeaobbsdjnckuuxk` | — (DB gestionada) |

⚠️ **Vercel i Render NO es redeployen** quan es commiteja canvis a cap capa nativa. Les capes natives (Android/iOS) es construeixen i deployen manualment amb Android Studio i Xcode, respectivament. Mentre la capa nativa estigui en proves de camp, **no s'apuja a prod**.

## Plugins natius

| Plataforma | Path | Build tool | Estat |
|---|---|---|---|
| Android | `frontend/plugins/location-sync/android/` | Gradle (Android Studio) | ⚠️ SPEC-010 pendent |
| iOS | `frontend/plugins/location-sync/ios/` | Xcode 15+ | ⚠️ SPEC-020 pendent |

## Tests baseline

| Capa | Baseline | Excepcions |
|---|---|---|
| Backend (pytest) | 152/152 | 10 WS timing preexistents (ignorar) |
| Frontend (Vitest) | 108/108 | 6 skipped preexistents (ignorar) |
| Android (JUnit) | 0/0 | Deute tècnic (SPEC-110) |
| iOS (XCTest) | 0/0 | Deute tècnic (SPEC-110) |

## Política de canvis

1. **Cap commit directe** a `main` o `develop`.
2. **Sempre branca de treball** (`feat/`, `fix/`, `refactor/`, `docs/`).
3. **PR a `develop`** quan llest.
4. **Merge a `main`** només per Tech Lead o release.
5. **AI agents** només commitejen si l'usuari ho demana explícitament.

## On mirar en cas de dubte

| Dubte | Fitxer |
|---|---|
| On som? | `.pathguard/STATE.json` |
| Què toca fer? | `.pathguard/STATE.json` > `next_session_pickup` |
| Quines specs hi ha obertes? | `specs/000-index.md` |
| Quina fase del projecte? | `docs/phases/phase-status.md` |
| Quin és el rol del meu agent? | `agents/INDEX.md` |
| Quines regles no negociables? | `CONTEXT.md` |
| Quin és l'estat del repo? | Aquest fitxer |

## Manteniment

Aquest fitxer s'actualitza quan:
- Es creen o esborren branques oficials
- Es creen o esborren tags
- Canvia l'estat de deploy
- Canvia la política de canvis
