# PathGuard — Getting Started

Guia ràpida per començar a treballar al projecte localment.

## Prerequisits

- **Python 3.11+** amb [micromamba](https://mamba.readthedocs.io/) (recomanat) o venv
- **Node.js 18+** (idealment 20)
- **Git**
- (Opcional) **Android Studio** per a la capa Android
- (Opcional) **Xcode 15+** per a la capa iOS (només macOS)

## Setup ràpid

### 1. Clonar el repo

```bash
git clone <repo-url>
cd PathGuard-project
```

### 2. Backend (FastAPI)

```bash
cd backend
micromamba env create -f environment.yml
micromamba activate tracker-env
pip install -r requirements.txt
python init_db.py
python -m uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

### 3. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.example .env.local  # si cal
npm run dev
```

App: `http://localhost:3000`

## Tests

```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend
cd frontend && npm test
cd frontend && npm run build --webpack
```

**Baseline:** 152/152 backend, 108/108 frontend.

## Estructura

```
PathGuard-project/
├── backend/                # FastAPI + PostgreSQL/SQLite
├── frontend/               # Next.js PWA + Capacitor
│   ├── plugins/location-sync/  # Capacitor plugin (iOS + Android)
│   ├── android/                # Android project
│   ├── ios/                    # iOS project
│   └── app/                    # Next.js pages
├── specs/                  # SDD specs (feature/tech/integration)
├── docs/                   # Documentació
│   ├── architecture/      # Visió general
│   ├── decisions/         # ADRs
│   ├── guides/            # Guies pràctiques
│   ├── phases/            # Estat per fase
│   └── archive/           # Documents antics (només lectura)
├── agents/                 # Mapa d'agents i skills
├── ROADMAP/                # Milestones, beta-readiness
├── .pathguard/             # Sistema d'agents i skills
│   ├── STATE.example.json
│   └── skills/            # Skills activables
└── .audit_archive/         # Auditories històriques (només lectura)
```

## Com treballar

1. **Carrega** `.opencode/skills/pathguard-core-state/SKILL.md` (saber on som)
2. **Identifica el teu rol** a `agents/INDEX.md`
3. **Carrega el skill del teu rol**
4. **Si la tasca és SDD**, carrega el skill de workflow
5. **Mai** commit directe a `main` o `develop`

## Proves natives (opcional)

### Android

```bash
cd frontend/android
./gradlew assembleDebug
# Obre frontend/android/ a Android Studio
```

### iOS

```bash
cd frontend
npx cap sync ios
cd ios/App
open App.xcworkspace
# Build: Cmd+B a Xcode
```

## Troubleshooting

| Problema | Solució |
|---|---|
| `pytest` no troba tests | Activa `tracker-env` i `cd backend` |
| `next dev` falla | Comprova `frontend/.env.local` |
| Android build falla | Comprova que `JAVA_HOME` apunta a JDK 17+ |
| iOS build falla | Comprova Xcode 15+ i signing config |
| WS no connecta | Comprova `NEXT_PUBLIC_WS_URL` a `.env.local` |

## Més informació

- [`../CONTEXT.md`](../../CONTEXT.md) — Golden rules
- [`../docs/architecture/overview.md`](../architecture/overview.md) — Visió arquitectònica
- [`../docs/guides/real-world-testing.md`](real-world-testing.md) — Proves de camp
- [`../docs/guides/deployment.md`](deployment.md) — Deploy
