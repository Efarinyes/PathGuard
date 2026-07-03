# PathGuard — Deployment Guide

## Entorns

| Entorn | Frontend | Backend | DB |
|---|---|---|---|
| **Local** | `http://localhost:3000` | `http://localhost:8000` | SQLite |
| **Staging** | (Vercel preview) | Render staging | PostgreSQL staging |
| **Production** | https://path-guard-orpin.vercel.app | https://pathguard-sjxy.onrender.com | Supabase PostgreSQL |

## Local

Ja cobert a [`getting-started.md`](getting-started.md).

## Production (Vercel + Render + Supabase)

### Frontend (Vercel)

1. Vercel connectat al repo GitHub
2. Auto-deploy des de `main`
3. Env vars configurades a Vercel:
   - `NEXT_PUBLIC_API_URL=https://pathguard-sjxy.onrender.com/api/v1`
   - `NEXT_PUBLIC_WS_URL=wss://pathguard-sjxy.onrender.com/api/v1/ws`

### Backend (Render)

1. Render Web Service connectat al repo
2. Auto-deploy des de `main`
3. Configuració:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free (o Starter per evitar cold starts)

4. Env vars a Render:
   - `DATABASE_URL=postgresql://postgres.cduokeaobbsdjnckuuxk:...@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`
   - `SECRET_KEY=<random-32-chars>`
   - `FRONTEND_URL=https://path-guard-orpin.vercel.app`
   - `ADDITIONAL_CORS_ORIGINS=<preview-urls-comma-separated>`
   - `API_V1_STR=/api/v1`
   - `PROJECT_NAME=PathGuard API`

### Database (Supabase)

1. Projecte Supabase (eu-west-1, ref: `cduokeaobbsdjnckuuxk`)
2. Connection via **Supavisor session pooler** (IPv4-compatible)
3. Pooler hostname: `aws-0-eu-west-1.pooler.supabase.com`
4. ⚠️ Connexió directa és IPv6-only — sempre usar pooler

### CORS

`backend/app/main.py` configura:

```python
ALLOWED_ORIGINS = [
    settings.FRONTEND_URL,        # Vercel prod
    "http://localhost:3000",       # Local dev
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]

if settings.ADDITIONAL_CORS_ORIGINS:
    for origin in settings.ADDITIONAL_CORS_ORIGINS.split(","):
        ALLOWED_ORIGINS.append(origin.strip())
```

⚠️ `allow_origins=["*"]` NO funciona amb `allow_credentials=True`. Especificar origins.

## App nativa (Capacitor)

### Configuració

`frontend/capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
  appId: 'com.pathguard.app',
  appName: 'PathGuard',
  webDir: 'public',
  server: {
    url: 'https://path-guard-orpin.vercel.app',
    cleartext: false,
  },
};
```

⚠️ **URL del servidor hardcoded** — canviar per entorn (deute tècnic).

### Build

```bash
# Després de canvis a capacitor.config.ts
cd frontend
npx cap sync ios
npx cap sync android
```

### Release Android

1. Actualitzar `versionCode` i `versionName` a `android/app/build.gradle`
2. `cd frontend/android && ./gradlew assembleRelease`
3. APK a `app/build/outputs/apk/release/`
4. Pujar a Google Play Console

### Release iOS

1. Actualitzar `CFBundleShortVersionString` i `CFBundleVersion` a Xcode
2. `xcodebuild -workspace App/App.xcworkspace -scheme App -configuration Release`
3. IPA a `build/`
4. Pujar a App Store Connect

## Cold starts

| Plataforma | Comportament | Solució |
|---|---|---|
| Render free tier | Spin-down 15 min inactivitat | Cron ping cada 10 min (cron-job.org) |
| Vercel | No aplica (serverless) | — |
| Supabase free | Pausa after 7 days inactivity | Upgrade if needed |

## Observabilitat

| Eina | Ús |
|---|---|
| Render logs | Backend errors |
| Vercel logs | Frontend errors |
| Sentry (futur) | Error tracking centralitzat |

## Secrets

**Mai** al codi. Mai al git. Sempre env vars.

| Secret | On |
|---|---|
| `DATABASE_URL` | Render env (prod), `.env` (dev) |
| `SECRET_KEY` | Render env, `.env` |
| `FRONTEND_URL` | Render env |
| `MATCH_PASSWORD` | GitHub Secrets (iOS) |
| `KEYSTORE_PASS` | GitHub Secrets (Android) |

## Rollback

| Plataforma | Com |
|---|---|
| Vercel | Dashboard → Deployments → Promote previous |
| Render | Dashboard → Manual Deploy → previous commit |
| Database | ⚠️ Cal migració enrere (Alembic — no usat actualment) |

## Checklist pre-deploy

- [ ] Tests verds localment (152/152 + 108/108)
- [ ] Build OK
- [ ] CHANGELOG actualitzat
- [ ] Tag semver creat
- [ ] Env vars configurades
- [ ] Sign-off de QA
- [ ] Manual deploy verification

## Referències

- [`../architecture/overview.md`](../architecture/overview.md)
- [`real-world-testing.md`](real-world-testing.md) — Validació de camp
- [`../../CONTEXT.md`](../../CONTEXT.md)
