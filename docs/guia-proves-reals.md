<!-- ARXIVAT 2026-06-30: document històric. Veure docs/INDEX.md per la documentació activa. -->

# PathGuard — Guia de Proves Reals en Dispositius

## Resum

Proves amb dos dispositius reals: un mòbil per al pacient (GPS + PWA) i un ordinador o mòbil per al cuidador (monitorització via WebSocket).

**Arquitectura Beta:**
```
Mòbil (PWA) ──HTTPS──▶ Vercel (frontend)
                         │
                         │ fetch() + WebSocket (wss://)
                         ▼
                    ngrok tunnel (HTTPS/WSS)
                         │
                         ▼
                  Local Mac (backend uvicorn + SQLite)
```

---

## Requisits previs

- Compte [Vercel](https://vercel.com) (gratuït) vinculat al repositori GitHub
- Compte [ngrok](https://ngrok.com) (gratuït amb email verificat per domini fixe)
- `micromamba` amb l'entorn `tracker-env` actiu
- Dos dispositius amb accés a Internet (un mòbil per al pacient, un ordinador o mòbil per al cuidador)

---

## Alternativa a ngrok — Render (backend al núvol gratis)

Render és un servei de hosting gratuït que permet desplegar el backend de PathGuard (FastAPI + WebSocket + SQLite) sense necessitat de tenir el teu ordinador encès ni ngrok corrent.

**Arquitectura alternativa:**
```
Mòbil (PWA) ──HTTPS──▶ Vercel (frontend)
                         │
                         │ fetch() + WebSocket (wss://)
                         ▼
                   Render (backend FastAPI + SQLite)
```

**Avantatges:**
- No cal tenir l'ordinador encès
- URL fixa (no com ngrok que canvia si no tens domini reservat)
- WebSocket natiu (Render el suporta sense configuració extra)
- Zero configuració de xarxa/tunnels

**Limitacions del free tier:**
| Aspecte | Comportament | Impacte |
|---------|-------------|---------|
| Spin-down | 15 min d'inactivitat → s'atura | Tarda 15-30s en reescalfar-se. Solució: cron-job.org fent ping cada 10 min |
| SQLite | S'esborra en cada restart/redeploy | Cal tornar a registrar-se. Solució: PostgreSQL de pagament ($7/mes) |
| RAM | 512 MB | Suficient per proves beta |
| Ample de banda | 100 GB/mes | Suficient per proves |

### 0.1 Preparar el codi per Render

Crear `backend/requirements.txt` (ja existeix al repo):

```txt
fastapi==0.136.0
uvicorn[standard]==0.44.0
pydantic==2.13.2
pydantic-settings==2.13.1
SQLAlchemy==2.0.49
python-jose[cryptography]==3.5.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.26
email-validator==2.3.0
websockets==16.0
python-dotenv==1.2.2
```

Crear `backend/runtime.txt` (ja existeix al repo):

```
python-3.11.11
```

Render llegirà aquests fitxers automàticament i instal·larà les dependències.

### 0.2 Desplegar backend a Render

1. Ves a https://dashboard.render.com → **New Web Service**
2. Connecta el compte de GitHub i selecciona el repo `PathGuard`
3. Configura el servei:
   | Camp | Valor |
   |------|-------|
   | **Root Directory** | `backend` |
   | **Runtime** | Python 3 |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | **Plan** | Free |
4. Clica **Create Web Service**

### 0.3 Configurar variables d'entorn a Render

Al dashboard de Render → Environment (o durant la creació del servei):

| Variable | Valor |
|----------|-------|
| `SECRET_KEY` | Genera'n una amb `openssl rand -hex 32` |
| `FRONTEND_URL` | `https://path-guard-orpin.vercel.app` |
| `ADDITIONAL_CORS_ORIGINS` | `https://path-guard-orpin.vercel.app` |
| `ENVIRONMENT` | `production` |

**Important:** `FRONTEND_URL` ha de ser el teu domini Vercel exacte. Si Vercel genera URLs de preview (ex: `path-guard-git-main-eduard-farinyes-projects.vercel.app`), afegeix-les també a `ADDITIONAL_CORS_ORIGINS` separades per comes.

### 0.4 Actualitzar Vercel

Al Vercel dashboard → **Settings → Environment Variables**:

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://pathguard-sjxy.onrender.com/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `wss://pathguard-sjxy.onrender.com/api/v1/ws/` |

Si vas posar un nom diferent a Render, substitueix `pathguard-sjxy` pel nom del teu servei.

Després d'actualitzar les env vars, redeploya el frontend a Vercel.

### 0.5 Verificar que tot funciona

```bash
# Prova bàsica
curl -s https://pathguard-sjxy.onrender.com/api/v1/
# → {"detail":"Not Found"}  (correcte)

# Swagger UI
curl -s https://pathguard-sjxy.onrender.com/docs
# → HTML visible

# CORS
curl -s -H "Origin: https://path-guard-orpin.vercel.app" \
  -D - https://pathguard-sjxy.onrender.com/api/v1/auth/me 2>&1 | grep -i access-control
# → access-control-allow-origin: https://path-guard-orpin.vercel.app
```

### 0.6 Opcional: evitar spin-down amb cron-job

El free tier de Render s'atura després de 15 minuts sense activitat. Per mantenir-lo despert durant les proves:

1. Ves a https://cron-job.org (gratuït)
2. Crea un cron job que faci GET a `https://pathguard-sjxy.onrender.com` cada 10 minuts

Això mantindrà el servei actiu mentre estiguis fent proves.

---

## Pas 1 — Instal·lar i configurar ngrok

### 1.1 Instal·lar ngrok

```bash
# macOS
brew install ngrok
```

O descarrega des de https://ngrok.com/download

### 1.2 Autenticar (només la primera vegada)

1. Ves a https://dashboard.ngrok.com/get-started/your-authtoken
2. Copia el teu authtoken
3. Executa:

```bash
ngrok config add-authtoken EL_TEU_TOKEN
```

### 1.3 Reservar un domini fixe (recomanat)

Amb un compte ngrok verificat (gratuït), pots reservar un domini fixe:

1. Ves a https://dashboard.ngrok.com/domains
2. Clica "New Domain" → obté un domini tipus `xxxx-ngrok-free.app`
3. Anota aquest domini — el necessitaràs per a Vercel i CORS

**Per què és important?** Sense domini fixe, ngrok genera una URL aleatòria cada cop que el reinicies. Això vol dir que has d'actualitzar les env vars a Vercel i el CORS al backend cada vegada. Amb domini fixe, la URL no canvia mai.

### 1.4 Engegar el túnel ngrok

```bash
ngrok http 8000 --domain EL_TEU_DOMINI.ngrok-free.app
```

Exemple amb domini fixe:

```bash
ngrok http 8000 --domain pathguard-dev.ngrok-free.app
```

ngrok mostrarà:

```
Forwarding  https://pathguard-dev.ngrok-free.app -> http://localhost:8000
```

**Mantén aquesta terminal oberta** — ngrok ha d'estar corrent mentre facis proves.

### 1.5 Verificar que ngrok funciona

Obre el navegador: `https://EL_TEU_DOMINI.ngrok-free.app/docs`

Hauries de veure la documentació Swagger de l'API. Si no la veus, verifica que el backend està corrent al pas 2.

---

## Pas 2 — Preparar i engegar el backend

### 2.1 Configurar les variables d'entorn

Edita `backend/.env`:

```env
# Security — genera un nou secret per producció
SECRET_KEY=un-nou-secret-segur-de-32-caracters-minim

# Frontend URL — el domini Vercel on estarà el frontend
FRONTEND_URL=https://pathguard.vercel.app

# Additional CORS origins — el domini ngrok per si cal accedir directament
ADDITIONAL_CORS_ORIGINS=https://EL_TEU_DOMINI.ngrok-free.app
```

**Important:** `FRONTEND_URL` ha de ser el domini Vercel exacte. `ADDITIONAL_CORS_ORIGINS` ha d'incloure el domini ngrok. Si Vercel genera dominis de preview (ex: `pathguard-git-feat-xxx.vercel.app`), afegeix-los també separats per comes.

### 2.2 Inicialitzar la base de dades (només la primera vegada)

```bash
cd backend
rm -f pathguard.db
python init_db.py
```

### 2.3 Engegar el backend

```bash
cd backend
micromamba activate tracker-env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2.4 Verificar que funciona

```bash
curl http://localhost:8000/docs
```

O obre `http://localhost:8000/docs` al navegador.

### 2.5 Verificar CORS

Des del navegador al domini Vercel, obre DevTools → Console i executa:

```javascript
fetch('https://EL_TEU_DOMINI.ngrok-free.app/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@test.com', password: 'test' })
}).then(r => r.json()).then(console.log)
```

Si retorna un error d'auth (401) i no un error CORS (403), CORS està ben configurat.

---

## Pas 3 — Desplegar el frontend a Vercel

### 3.1 Vincular el repositori a Vercel

1. Ves a https://vercel.com/new
2. Importa el repositori `Efarinyes/PathGuard` des de GitHub
3. Configura el projecte:
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend` (clica "Edit" al costat de Root Directory)
   - **Build Command:** `next build --webpack` (NO `next build` sol)
   - **Output Directory:** (deixa el valor per defecte)
4. **NO cliquis "Deploy" encara** — primer cal configurar les env vars

### 3.2 Configurar les variables d'entorn a Vercel

Al Vercel dashboard, ves a Settings → Environment Variables. Afegeix:

| Variable | Valor | Entorns |
|----------|-------|---------|
| `NEXT_PUBLIC_API_URL` | `https://EL_TEU_DOMINI.ngrok-free.app/api/v1` | Production, Preview, Development |
| `NEXT_PUBLIC_WS_URL` | `wss://EL_TEU_DOMINI.ngrok-free.app/api/v1/ws/` | Production, Preview, Development |
| `NEXT_PUBLIC_ENABLE_SW_ON_LOCALHOST` | `true` | Development (opcional, per proves locals) |

**Important:** `NEXT_PUBLIC_WS_URL` ha de ser `wss://` (amb doble s), no `ws://`. El navegador bloqueja `ws://` des de pàgines HTTPS (mixed content).

### 3.3 Desplegar

1. Clica "Deploy" a Vercel
2. Espera que el build completi (normalment ~2 minuts)
3. Anota la URL de producció (ex: `https://pathguard.vercel.app`)

### 3.4 Verificar el desplegament

Obre `https://pathguard.vercel.app` al navegador:

1. La landing page ha de carregar correctament
2. Obre DevTools → Application → Service Workers → ha d'aparèixer `pathguard-sw.js` registrat
3. Obre DevTools → Console → no hi ha d'haver cap error CORS ni de connexió

Si Vercel genera una URL de preview diferent (ex: `pathguard-xxxxx.vercel.app`), afegeix-la a `ADDITIONAL_CORS_ORIGINS` al `backend/.env` i reinicia uvicorn.

---

## Pas 4 — Prova completa end-to-end

### Escenari 1: Registre + activació

1. **Cuidador (ordinador):** Obre `https://pathguard.vercel.app` → "Crear entorn familiar"
2. **Cuidador:** Omple el formulari (nom del grup, nom del pacient, email, contrasenya)
3. **Cuidador:** Veure el codi d'activació (ex: `A3K7M`) a la pantalla de confirmació
4. **Pacient (mòbil):** Obre `https://pathguard.vercel.app/activate` (afegir a pantalla d'inici per PWA)
5. **Pacient:** Introdueix el codi `A3K7M`
6. **Pacient:** Queda vinculat → pantalla `/patient` ("Comença a passejar")
7. **Cuidador:** Obre `https://pathguard.vercel.app/caregiver` → veu el pacient connectat

### Escenari 2: Passeig real amb GPS

1. **Pacient:** Prem "Comença a passejar" (sortir al carrer amb el mòbil)
2. **Cuidador:** Veure la ubicació en temps real al mapa
3. **Pacient:** Camina 1-2 minuts
4. **Pacient:** Prem "Parem!" (atura el passeig)
5. **Cuidador:** Veure el passeig finalitzat a l'historial

### Escenari 3: SOS

1. **Pacient:** Inicia un passeig
2. **Pacient:** Manté premut el botó SOS (3 segons)
3. **Cuidador:** Sent el chime càlid (440→523→660Hz)
4. **Cuidador:** Veure el modal "NomPacient ha enviat un avís d'emergència"
5. **Cuidador:** Prem "D'acord, ho he rebut"

### Escenari 4: Pèrdua de cobertura

1. **Pacient:** Inicia un passeig amb GPS actiu
2. **Pacient:** Entra en un lloc sense cobertura (túnel, parking subterrani) o activa mode avió
3. **Cuidador:** Veure "Passeig actiu - Sense cobertura" amb indicador taronja ✅ (ara funciona amb el fix BUG1-5)
4. **Pacient:** Surt del túnel / desactiva mode avió
5. **Cuidador:** Veure "Passeig actiu - En línia" amb indicador verd
6. **Cuidador:** Notificació "El familiar ha recuperat la cobertura" (només després del primer event WS, no fals positiu a l'inici)

### Escenari 5: Owner dashboard

1. **Cuidador (owner):** Clica la icona d'hamburguesa → "Dashboard"
2. **Owner:** Veure codi d'activació del dispositiu (clica "Revelar codi")
3. **Owner:** Toggle SOS activat/desactivat
4. **Owner:** Veure històric de passejades amb detall al mapa

---

## Checklist de verificació Beta

### Backend
- [ ] `micromamba activate tracker-env` funciona
- [ ] `rm -f backend/pathguard.db && python backend/init_db.py` crea BD neta
- [ ] Backend engega sense errors: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- [ ] ngrok respon: `https://EL_TEU_DOMINI.ngrok-free.app/docs` mostra Swagger

### CORS i connexions
- [ ] `FRONTEND_URL` al `.env` apunta al domini Vercel
- [ ] `ADDITIONAL_CORS_ORIGINS` al `.env` inclou el domini ngrok
- [ ] `NEXT_PUBLIC_API_URL` i `NEXT_PUBLIC_WS_URL` configurats al Vercel dashboard
- [ ] CORS no bloqueja request des del domini Vercel (zero errors 403/405 a DevTools)
- [ ] WebSocket connecta des de Vercel → ngrok → backend (DevTools Network, status 101)

### Frontend (Vercel)
- [ ] Build a Vercel passa sense errors
- [ ] Landing page carrega a `https://pathguard.vercel.app`
- [ ] Service Worker registrat (DevTools → Application → Service Workers)
- [ ] Zero `console.log` a producció (DevTools Console, només errors legítims)

### Proves funcionals
- [ ] `POST /auth/register` retorna `activation_code`
- [ ] Registre → codi → activació → `/patient` end-to-end des de mòbil
- [ ] Cuidador fa login → veu dashboard amb pacient connectat
- [ ] Passeig real GPS: iniciar → caminar → veure posició temps real → aturar
- [ ] SOS: mantenir 3s → chime se sent al cuidador → modal → confirmar recepció
- [ ] Pèrdua de cobertura: mostrar "Sense cobertura" (taronja) → recuperar "En línia" (verd) → notificació
- [ ] Owner dashboard: toggle SOS, codi activació, històric passejades
- [ ] Service Worker no cacheja API calls (NetworkOnly a DevTools)

---

## Neteja de Service Worker

Si has provat versions anteriors i el SW antic està cachejat:

### Chrome (ordinador)
1. `DevTools → Application → Service Workers → Unregister`
2. `DevTools → Application → Storage → Clear site data`

### Chrome (mòbil Android)
1. `chrome://serviceworker-internals` → buscar PathGuard → Unregister
2. O: Configuració del lloc → Esborra dades

### Safari (iOS — més complicat)
1. Ajustos → Safari → Avançat → Dades del lloc web → Eliminar
2. O: Ajustos → General → iPhone Storage → Safari → Esborra històric i dades

---

## Pegats coneguts per a proves reals

- **ngrok canvia d'URL** si no tens domini fixe → cal actualitzar env vars a Vercel i CORS al backend cada restart. Recomanat: reservar domini fixe amb compte ngrok verificat (gratuït).
- **iOS Safari:** GPS funciona millor si la PWA està "Added to Home Screen"
- **WebSocket:** 10 test de timing fallen (preexistent, no afecta proves reals)
- **Bateria:** monitorització eliminada (incompatible amb Safari)
- **CORS:** `allow_credentials=True` NO funciona amb `allow_origins=["*"]` — cal especificar els orígens exactes via `FRONTEND_URL` + `ADDITIONAL_CORS_ORIGINS`
- **PWA a mòbil:** Cal accedir via HTTPS (Vercel ja ho proporciona). "Afegir a pantalla d'inici" per millor experiència GPS.

---

## Resolució de problemes

### CORS error (403/405)
1. Verifica `FRONTEND_URL` i `ADDITIONAL_CORS_ORIGINS` al `backend/.env`
2. Verifica que els dominis no tenen `/` final (ex: `https://pathguard.vercel.app`, NO `https://pathguard.vercel.app/`)
3. Reinicia uvicorn després de canviar `.env`
4. Verifica al Vercel dashboard que les env vars són correctes

### WebSocket no connecta
1. Verifica `NEXT_PUBLIC_WS_URL` és `wss://` (no `ws://`)
2. Verifica que ngrok està corrent i el domini és correcte
3. Obre DevTools → Network → filtra per `WS` → ha d'aparèixer una connexió amb status 101

### PWA no instal·lable
1. Verifica que el manifest carrega: `https://pathguard.vercel.app/manifest.json`
2. Verifica que el SW es registre: DevTools → Application → Service Workers
3. Verifica HTTPS (Vercel ja ho proporciona)

### Base de dades buida després de reiniciar
1. Per defecte SQLite crea `pathguard.db` al directori on s'engega uvicorn
2. Assegura't d'engegar uvicorn des del directori `backend/`: `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`