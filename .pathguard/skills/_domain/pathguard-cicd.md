---
name: pathguard-cicd
description: |
  Pipelines CI/CD, secrets, builds i releases. Carregar quan
  es crea/modifica un workflow, es configuren secrets, o es
  planifica un release.
triggers:
  - Modificar .github/workflows/
  - Configurar env vars
  - Crear tag / release
  - Build APK/IPA
agent_owner: devops
prerequisites:
  - pathguard-agent-devops
---

# CI/CD — Pipelines i operacions

## Pipelines

| Workflow | Trigger | Què fa |
|---|---|---|
| `lint.yml` | PR, push | ESLint, ruff, black |
| `test.yml` | PR, push | pytest + vitest |
| `build.yml` | PR, push | next build, gradle assembleDebug |
| `release.yml` | Tag `v*` | APK release, IPA release, GitHub Release |

## Estructura esperada

```
.github/workflows/
├── lint.yml
├── test.yml
├── build.yml
└── release.yml
```

## Pipeline de test (exemple)

```yaml
# .github/workflows/test.yml
name: tests

on:
  pull_request:
  push:
    branches: [develop, main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run tests
        run: |
          cd backend
          pytest tests/ -v

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      - name: Run tests
        run: |
          cd frontend
          npm test
      - name: Build
        run: |
          cd frontend
          npm run build --webpack
```

## Pipeline de release

```yaml
# .github/workflows/release.yml
name: release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
      - name: Build APK
        run: |
          cd frontend/android
          ./gradlew assembleRelease
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: app-release.apk
          path: frontend/android/app/build/outputs/apk/release/app-release.apk

  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.0'
      - name: Sync Capacitor
        run: |
          cd frontend
          npm ci
          npx cap sync ios
      - name: Build IPA
        run: |
          cd frontend/ios
          xcodebuild -workspace App/App.xcworkspace -scheme App \
            -configuration Release \
            -archivePath build/App.xcarchive \
            CODE_SIGNING_ALLOWED=NO
      - name: Upload IPA
        uses: actions/upload-artifact@v4
        with:
          name: app-release.ipa
          path: frontend/ios/build/App.xcarchive

  create-release:
    needs: [build-android, build-ios]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            app-release.apk
            app-release.ipa
          generate_release_notes: true
```

## Secrets

| Secret | On | Ús |
|---|---|---|
| `MATCH_PASSWORD` | GitHub Secrets | iOS signing (Fastlane Match) |
| `KEYSTORE_PASS` | GitHub Secrets | Android signing |
| `KEY_ALIAS` | GitHub Secrets | Android signing |
| `SENTRY_DSN` | Vercel/Render env | Error tracking |
| `DATABASE_URL` | Render env | PostgreSQL connection |
| `SECRET_KEY` | Render env | JWT signing |

**Mai** secrets al codi. Mai al git. Sempre env vars.

## Build apps natives

### Android APK
```bash
cd frontend/android
./gradlew assembleDebug      # APK debug
./gradlew assembleRelease    # APK release
```

### iOS IPA
```bash
cd frontend
npm ci
npx cap sync ios
cd ios
xcodebuild -workspace App/App.xcworkspace -scheme App \
  -configuration Release \
  -archivePath build/App.xcarchive
```

## Deploy web (auto via Vercel)

Vercel detecta push a `main` i desplega automàticament.

**Env vars a Vercel:**
- `NEXT_PUBLIC_API_URL` — `https://pathguard-sjxy.onrender.com/api/v1`
- `NEXT_PUBLIC_WS_URL` — `wss://pathguard-sjxy.onrender.com/api/v1/ws`

## Deploy backend (auto via Render)

Render detecta push a `main` i desplega.

**Env vars a Render:**
- `DATABASE_URL` — PostgreSQL Supabase
- `SECRET_KEY` — JWT signing
- `FRONTEND_URL` — Vercel URL (CORS)
- `ADDITIONAL_CORS_ORIGINS` — previews Vercel

## Cold starts

- **Render free tier:** spin-down 15 min inactivitat. Solució: cron ping cada 10 min.
- **Vercel:** no aplica (serverless).
- **Supabase free tier:** pauses after 7 days inactivity on free project. Upgrade if needed.

## Observabilitat

| Eina | Ús |
|---|---|
| Render logs | Backend errors |
| Vercel logs | Frontend errors |
| Sentry (futur) | Error tracking centralitzat |
| Custom logger | Estructurat (JSON) |

**Backend logger:** `logger.info/warning/error` (mai `print()`).

## Errors comuns

❌ Secrets al codi
❌ Tests contra producció
❌ Pipeline > 10 min
❌ Build sense signing config
❌ Tag sense CHANGELOG entry
