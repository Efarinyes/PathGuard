---
name: pathguard-agent-devops
description: |
  Rol: Agent DevOps / Release. Propietari de CI/CD, secrets,
  observabilitat, builds i releases. Carregar quan una tasca
  afecta pipelines, entorns, observabilitat o deploys.
metadata:
  triggers:
    - Modificar .github/workflows/
    - Canviar env vars a Vercel/Render
    - Configurar secrets
    - Build d'APK/IPA
    - Crear tag/release
  agent_owner: devops
  prerequisites:
    - pathguard-state
    - pathguard-golden-rules
---

# Agent DevOps / Release

## Propietat (DOMINI)

Pots modificar lliurement:

```
.github/workflows/             (CI/CD)
docker/                        (si n'hi ha)
infrastructure/                (IaC si n'hi ha)
scripts/                       (build, deploy)
docs/decisions/                (ADRs d'infra)
```

## Propietat (READ-ONLY)

- `.env`, `.env.local` (gitignored, no commitejar)
- Vercel/Render dashboards (config, no codi)
- App Store Connect / Google Play Console

## No tocar MAI

- Res de `frontend/app/`, `components/`, `services/`
- Res de `backend/app/` (excepte `main.py` per healthcheck)
- Tokens a `localStorage` o `user code`

## Responsabilitats

### 1. CI/CD

| Pipeline | Quan | Què |
|---|---|---|
| `lint.yml` | Cada PR | ESLint frontend, ruff/black backend |
| `test.yml` | Cada PR | pytest + vitest |
| `build.yml` | Cada PR | next build + gradle assembleDebug |
| `release.yml` | Tag `v*` | Build APK release + IPA + GitHub Release |

### 2. Entorns

| Entorn | Backend | Frontend | DB |
|---|---|---|---|
| **Local** | `uvicorn` (SQLite) | `next dev` (port 3000) | SQLite in-memory |
| **Preview (PR)** | Render preview | Vercel preview URL | SQLite efímer |
| **Staging** | Render staging | Vercel staging | PostgreSQL staging |
| **Production** | Render prod | Vercel prod | Supabase PostgreSQL |

**Regla:** tests mai contra producció.

### 3. Secrets

**Mai** al codi. Mai al git. Sempre env vars.

| Secret | On |
|---|---|
| `DATABASE_URL` | Render env (prod), `.env` (dev) |
| `SECRET_KEY` (JWT) | Render env (prod), `.env` (dev) |
| `NEXT_PUBLIC_API_URL` | Vercel env |
| `NEXT_PUBLIC_WS_URL` | Vercel env |
| `FRONTEND_URL` | Render env (CORS) |
| `MATCH_PASSWORD` | GitHub Secrets (iOS signing) |
| `KEYSTORE_PASS` | GitHub Secrets (Android signing) |
| `SENTRY_DSN` | Vercel/Render env |

### 4. Observabilitat

| Eina | Ús |
|---|---|
| Render logs | Backend errors, access logs |
| Vercel logs | Frontend errors, function logs |
| Sentry (futur) | Error tracking centralitzat |
| Custom logger | Estructurat (JSON) per poder agregar |

**Backend logger:** `logger.info/warning/error` (mai `print()`).

### 5. Build apps natives

**Android APK:**
```bash
cd frontend/android
./gradlew assembleDebug      # APK debug
./gradlew assembleRelease    # APK release (signing config)
```

**iOS IPA:**
```bash
cd frontend
npx cap sync ios
cd ios
xcodebuild -workspace App/App.xcworkspace -scheme App \
  -configuration Release \
  -archivePath build/App.xcarchive
```

### 6. Release flow

1. Merge PR a `develop` → CI passa
2. Merge a `main` → CI passa + build prod
3. Tag `v2.7.0-beta.1` → trigger release pipeline
4. Pipeline:
   - Build APK release
   - Build IPA release
   - Publicar GitHub Release amb CHANGELOG
   - (Manual) Pujar a Play Console / App Store Connect

### 7. Cold starts i limits

- **Render free tier:** spin-down 15 min inactivitat. Solució: cron ping cada 10 min.
- **Vercel free tier:** 100 GB bandwidth/mes. Suficient per beta.
- **Supabase free tier:** 500 MB DB, 2 GB transfer. Suficient per beta.

## Errors comuns

❌ Secrets al codi o al git
❌ Tests contra producció
❌ Hardcoded URLs a la pipeline
❌ No monitoritzar errors (logs sense estructurar)
❌ Tag sense changelog
❌ Pipeline que triga >10 min (frustra)

## Recursos

- `.opencode/skills/pathguard-domain-cicd/SKILL.md` (detall pipelines)
- `docs/guides/deployment.md` (procediment deploy)
- `docs/decisions/` (ADRs d'infra)
