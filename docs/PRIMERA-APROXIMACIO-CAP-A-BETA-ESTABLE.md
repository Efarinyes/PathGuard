# Primera Aproximació Cap a Beta Estable

**Basada en les proves reals del 26 de maig de 2026.**
**Alineada amb la filosofia PathGuard:** *calm, discreta, fiable — familiar, no clínica, no invasiva.*

---

## Context d'ús real (descobert a les proves)

| Rol | On obre l'app | Com hi accedeix |
|-----|--------------|-----------------|
| **/patient** | Telèfon mòbil (butxaca) | PWA instal·lada o navegador |
| **/caregiver** | Ordinador de sobretaula, portàtil **o** telèfon mòbil | PWA instal·lada (qualsevol dispositiu) o navegador |

**Conseqüència per al pla:** No podem assumir que `/caregiver` és només escriptori. El cuidador pot estar fora de casa mirant el mapa des del mòbil.

---

## Decisió arquitectònica: dues apps, una base de codi

| Rol | Eina | Motiu |
|-----|------|-------|
| **/patient** | **Capacitor** (app nativa) | GPS en background és imprescindible. El PWA no el manté (provat a iOS). |
| **/caregiver** | **PWA** + **Web Push API** (futur) | Funciona a ordinador i mòbil. Per SOS, Web Push notifica al cuidador encara que tanqui el navegador (Android Chrome). Opció a valorar: Capacitor per /caregiver si iOS no suporta Web Push. |

**Per què no les dues amb Capacitor des del primer dia?**
- /caregiver no necessita GPS en background
- /caregiver es beneficia de la PWA (instal·lació zero, actualització automàtica)
- Separar en dues apps manté el codi net: `/patient` té els plugins natius que necessita, `/caregiver` no carrega codi innecessari

---

## Branques

Cada fase es desenvolupa en una branca `fix/` o `feat/`, es mergeja a `develop`, es testa i després a `main` per desplegar.

```
main ── develop ── fix/ o feat/ (cada fase)
```

Branca de seguretat: `safety/pre-bcrypt-fix` (ja creada)

---

## Fase B — Distància de passeig (Punt 3) — ⏳ AJORNADA (post-beta)

**Problema:** La columna distància a l'historial de passejades sempre mostra `--`. El backend mai calcula ni emmagatzema la distància recorreguda.

**Decisió (31/05/2026):** **Ajornada.** La distància recorreguda no respon a una necessitat real del cuidador. El que importa és: va sortir? (historial), quant de temps? (durada), per on va anar? (mapa), a quines hores acostuma a sortir? (analítiques). La distància és una mètrica esportiva, no de tranquil·litat familiar.

**Queda documentada per si es vol implementar en el futur.** La funció Haversine al frontend (`frontend/lib/gpsUtils.ts`) i la interfície `WalkHistoryItem.distance_meters?` al frontend ja estan preparades.

### B.1 (futur) Afegir columna `distance_meters` al model Walk

**Arxiu:** `backend/app/db/models/walk.py`
**Canvi:** `distance_meters = Column(Float, nullable=True)`

### B.2 (futur) Calcular distància en `stop_walk()`

**Arxiu:** `backend/app/services/walk_service.py`
**Canvi:** Al mètode `stop_walk()`, recorre els punts GPS ordenats cronològicament i suma distàncies Haversine acumulades.

### B.3 (futur) Incloure `distance_meters` a la resposta de `GET /walks/`

**Arxiu:** `backend/app/services/walk_service.py`
**Canvi:** Afegir `distance_meters` al diccionari de retorn de `read_walks()`.

### B.4 (futur) Tests

- Test d'integració: iniciar passeig → enviar 2+ punts GPS → aturar → verificar `distance_meters > 0`
- Test unitari: funció Haversine amb coordenades conegudes (ex: 1km entre punts)

**Branca:** `feat/walk-distance`
**Estimació:** 2-3 hores
**Risc:** Baix

---

## Fase C + D — Reorganització completa del dashboard owner (Punts 4 i 5) — Substituït per pla de reorganització

**A partir del 31/05/2026, les Fases C i D originals queden substituïdes per un pla únic de reorganització del dashboard owner.**

**Document de referència:** `docs/REORGANITZACIO-DASHBOARD-OWNER.md`

### Decisió

En lloc de fer petits ajustos (C: unificar històric, D: separar config d'estadístiques), es redissenya l'arquitectura de navegació del dashboard owner amb **tres seccions al drawer**:

| # | Secció | Ruta | Contingut |
|---|--------|------|-----------|
| 1 | **Monitorització** | `/caregiver` | Mapa + estat en viu. Sense "afegir cuidador" ni "punts de ruta". |
| 2 | **Configuració del grup** | `/caregiver/dashboard` | SOS toggle, codi activació, afegir cuidador. Sense historial ni analytics. |
| 3 | **Activitat** (NOVA) | `/caregiver/activity` | Historial de passejos, analytics (durada, hores, freqüència), punts de ruta. |

### Canvis al mapa

El punt de posició actual al mapa passa de `primary` (blau) a `success` (verd) i més gran, per distingir visualment "on és ara" de "per on ha passat".

**Branca:** `refactor/reorganitzacio-dashboard`
**Estimació:** 2-3 hores
**Risc:** Baix-Mitjà

---

## Fase E — Capacitor per a /patient (Punts 1, 2 i 6)

**Problema:** La PWA no pot mantenir GPS en background a iOS (provat) ni Android sense permisos especials. El WebSocket es desconnecta, el backend declara `patient_offline` fals positiu, i la ruta dibuixada té buits on la cobertura era real.

**Decisió:** Crear una **app nativa amb Capacitor** per a la pantalla `/patient`. El frontend web (`/caregiver`, `/caregiver/dashboard`, `/activate`, `/register`) continua sent PWA.

**Per què només `/patient` amb Capacitor?**
- El pacient necessita GPS en background (passejar amb mòbil a la butxaca)
- El cuidador pot usar PWA al mòbil o a l'ordinador — suficient per veure el mapa i rebre SOS en temps real
- El codi React de `/patient` (~90%) es reutilitza sense canvis

### E.0 Requisits previs d'instal·lació

| Eina | Per a | Gratuïta? | Obligatòria? |
|------|-------|-----------|-------------|
| **Xcode** (macOS) | Build iOS, provar al simulador/dispositiu | Sí (App Store) | ✅ Sí |
| **Android Studio** (o només SDK cmdline) | Build Android, SDK + emulador | Sí | ✅ Sí |
| **VS Code** | Codi TypeScript/React | Sí | Ja el tens |
| **Capacitor CLI** | `npm install @capacitor/cli` | Sí (opensource) | ✅ Sí |

**Nota:** No cal canviar d'IDE. Tot el codi es segueix escrivint a VS Code. Xcode i Android Studio només s'obren per compilar i executar.

### E.1 Instal·lar Capacitor i afegir plataformes

```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npx cap init PathGuard com.pathguard.app
npx cap add ios
npx cap add android
```

**Commit:** `feat: add Capacitor platforms (ios + android)`

### E.2 Migrar hooks natius de /patient

| Fitxer actual | Plugin Capacitor | Funció |
|--------------|-----------------|--------|
| `hooks/useLocationTracking.ts` | `@capacitor/geolocation` | `Geolocation.watchPosition()` en background amb permisos automàtics |
| `hooks/useWebSocket.ts` | `@capacitor/background-task` | Manté el WS + heartbeat viu quan l'app va a background |
| `hooks/useSOSAlertSound.ts` | **No es toca** | El so SOS es genera al cuidador, no al pacient |
| Nou: hook connectivitat | `@capacitor/network` | Detecció de connectivitat real (no depèn del WS) |
| Nou: SOS trigger feedback | `@capacitor/local-notifications` | Mostra confirmació visual al pacient: "SOS enviat" (sense so, sense alarma) |

Cada migració **preserva la interfície dels hooks existents** perquè el codi de negoci (startWalk, stopWalk, SOS, etc.) no canviï.

**Commits:**
- `feat: migrate GPS to @capacitor/geolocation`
- `feat: add background task for WebSocket heartbeat`
- `feat: add native network listener`

### E.3 Configurar permisos nadius

**iOS (`ios/App/App/Info.plist`):**
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- `UIBackgroundModes` → `location`
- `BGTaskSchedulerPermittedIdentifiers`

**Android (`android/app/src/main/AndroidManifest.xml`):**
- `ACCESS_BACKGROUND_LOCATION` (Android 10+)
- `FOREGROUND_SERVICE_LOCATION`
- `POST_NOTIFICATIONS` (Android 13+)

### E.4 Notificacions SOS al cuidador (futur)

**Objectiu:** El cuidador rep notificació SOS encara que no tingui el dashboard obert al navegador.

**Decisió per a la beta:** **No implementar push ara.** Durant la beta, el cuidador té el dashboard obert (PWA instal·lada o pestanya del navegador). Si tanca el dashboard, no rep l'SOS — comportament conegut i acceptat.

**Futur (post-beta):** Quan el cuidador també sigui usuari mòbil habitual, avaluar:
- **Web Push API** — Gratuït, funciona a Android Chrome, limitat a iOS Safari
- **Firebase Cloud Messaging** — Push nadiu, requereix compte Firebase + adaptació del backend
- **Capacitor per /caregiver** — Si es decideix que també necessita capacitats natives

### E.5 Tests

- Prova real en dispositiu iOS i Android: pacient amb app nativa, pantalla apagada, mòbil a la butxaca, passeig de 10 minuts. El cuidador veu la ruta completa sense buits ni falsos offline.
- Prova real: el cuidador tanca el dashboard. El pacient envia SOS. El cuidador NO rep notificació (comportament esperat per ara).
- Prova de reinstal·lació: desinstal·lar l'app nativa i tornar a instal·lar (neteja de dades).

**Branca:** `feat/capacitor-patient-app`
**Estimació:** 3-5 dies (inclou instal·lació d'eines, migració, configuració de permisos, proves reals)
**Risc:** Alt — primer cop amb Capacitor. Mitigat perquè el 90% del codi es reutilitza.

---

## Criteris d'èxit de la beta estable

1. Un cuidador pot veure l'historial de passejades amb ruta al mapa, durada i horaris habituals
2. El dashboard d'owner mostra clarament la configuració del dispositiu (SOS, codi d'activació) separada de la informació d'activitat (historial, gràfiques)
3. El pacient pot passejar amb el mòbil a la butxaca (pantalla apagada) sense que el cuidador rebi falsos `offline`, gràcies a Capacitor
4. El cuidador rep l'alerta SOS si té el dashboard obert (PWA al mòbil o escriptori)
5. Les dades de passeig persisteixen als restarts del servidor (PostgreSQL)
6. El cuidador pot consultar la base de dades (via endpoint admin o client SQL)

---

## Fase F — Lògica adaptativa de seguiment /patient (Punt 7)

**Problema detectat a les proves:** `/patient` envia posició GPS cada 5 segons (interval normal) o cada 2 segons (moviment ràpid). Això és:

- **Invasiu:** una traça cada 5s és granularitat de repartiment, no de tranquil·litat familiar
- **Bateria:** el GPS actiu cada pocs segons consumeix la bateria del mòbil
- **Falsos offline:** com més peticions, més probabilitat de fallar-ne una i disparar l'offline
- **Innecessari:** el cuidador es tranquil·litza sabent la zona i la ruta, no la posició exacta cada 5 segons

**Decisió:** Ajustar intervals i distància mínima per alinear-se amb la filosofia PathGuard:

### F.1 Nous intervals GPS

**Arxiu:** `frontend/lib/config.ts`

| Constant | Valor actual | Nou valor | Motiu |
|----------|-------------|-----------|-------|
| `GPS_INTERVAL_FAST_MS` | 2000 (2s) | **15000 (15s)** | Caminar ràpid no requereix traça cada 2s |
| `GPS_INTERVAL_NORMAL_MS` | 5000 (5s) | **30000 (30s)** | Cada 30s és suficient per veure la ruta |
| `GPS_INTERVAL_IDLE_MS` | 15000 (15s) | **120000 (2 min)** | Aturat a un bar o aparador → sense notificar cada 15s |
| `GPS_MIN_DISTANCE_M` | 10 (metres) | **30 (metres)** | Evita punts redundants a cada aparador |

### F.2 Impacte esperat

| Mètrica | Abans | Després |
|---------|-------|---------|
| Peticions/hora (passeig normal) | ~720 (cada 5s) | ~120 (cada 30s) |
| Peticions/hora (aturat) | ~240 (cada 15s) | ~30 (cada 2 min) |
| Càrrega backend | Alta | Reduïda un 80% |
| Bateria mòbil en passeig d'1h | ~15-20% | ~5-8% |

### F.3 Impacte al mapa del cuidador

La ruta tindrà menys punts (30s en lloc de 5s), però la **traça general és idèntica**: el cuidador veu per on ha passat el familiar.

**Filosofia PathGuard:** Una traça cada 30s és tranquil·litzadora. Una traça cada 5s és vigilància.

### F.4 Tests

- Test unitari: verificar que els intervals nous es carreguen des de config.ts
- Test d'integració: iniciar passeig, esperar 60s, verificar que s'envien ~2 punts (no ~12)
- Test manual: passeig real de 10 minuts amb els nous intervals

**Branca:** `feat/gps-adaptive-logic`
**Estimació:** 30 minuts (canvi de 4 constants)
**Risc:** Molt baix

---

## Fase G — Migració a PostgreSQL (Punts 3, 5 i 8)

**Problema:** SQLite a Render no persisteix entre restarts i no es pot consultar externament. El cuidador/owner no pot accedir a les dades per veure analítiques, historials o detectar patrons.

**Objectiu:** Migrar la base de dades a PostgreSQL gestionat per Supabase (gratuït) o directament a Render ($7/mes).

### G.1 Escollir proveïdor

| Opció | Preu | PostgreSQL | Consultable externament? | Latència |
|-------|------|-----------|-------------------------|----------|
| **Supabase** | Gratuït | 500 MB | ✅ Table Editor al dashboard | ~10ms des de Render |
| **Render PostgreSQL** | $7/mes | 1 GB | ❌ No via client extern | ~1ms (mateix datacenter) |

**Recomanació per a la beta:** **Supabase** (gratuït, consultable via Table Editor, suficient per 3-5 grups).

### G.2 Passos de migració a Supabase

**G.2.1 Crear projecte a Supabase**

1. Ves a https://supabase.com → Sign up → New project
2. Copia la **Connection string (URI)** de Settings → Database

**G.2.2 Actualitzar configuració del backend**

**Arxiu:** `backend/.env` (local) o Environment Variables a Render

```env
DATABASE_URL=postgresql://postgres:xxxx@xxxx.supabase.co:5432/postgres
```

**G.2.3 Verificar que SQLAlchemy funciona amb PostgreSQL**

No cal canviar codi: `Base.metadata.create_all()` funciona igual amb PostgreSQL. El model `Walk` ja usa `Column(Float)` per `distance_meters` — compatible.

**Possibles incompatibilitats a revisar:**

- `DateTime` columnes: PostgreSQL espera `timezone=True` explícit. Revisar `start_time` i `end_time` a `Walk` i `timestamp` a `Location`.
- `String(36)` per `device_token`: compatible.
- `Boolean` default: PostgreSQL requereix `server_default` o default a Python. Revisar `Walk.active`, `Patient.activation_code_used`.

**G.2.4 Migrar dades (opcional)**

Per passar les dades de SQLite a PostgreSQL:

```bash
# Dump SQLite
sqlite3 pathguard.db .dump > dump.sql
# Editar dump: eliminar línies incompatibles (BEGIN/COMMIT, PRAGMA, etc.)
# Importar a Supabase via psql
psql $DATABASE_URL < dump_clean.sql
```

O simplement començar de zero (la BD és buida després de cada restart de Render).

### G.3 Consultar la base de dades

Amb Supabase, el Table Editor al dashboard permet:
- Veure totes les taules (User, Patient, Group, Walk, Location)
- Filtrar per columnes (ex: `active=True` per veure passeigs actius)
- Exportar a CSV per analitzar fora

**Alternativa:** Eina local tipus TablePlus o DBeaver connectant al Supabase PostgreSQL via SSL.

### G.4 Tests

- Test d'integració: connexió a PostgreSQL, crear taules, insertar i llegir un walk
- Test de regressió: tot el conjunt de tests (152 tests) ha de passar amb PostgreSQL

**Branca:** `feat/postgresql-migration`
**Estimació:** 1-2 dies (inclou creació del compte Supabase, configuració, tests de regressió)
**Risc:** Mitjà — pot requerir ajustos menors a les columnes DateTime i Boolean

### G.5 Flux d'arquitectura final (beta)

```
Vercel (frontend PWA /patient + /caregiver)
  │
  ├── fetch/WS → Render (FastAPI + WebSocket)
  │                      │
  │                      └── connect → Supabase PostgreSQL
  │
  └── Contacte directe (el frontend no canvia)

El cuidador/owner consulta dades via:
  - GET /api/v1/walks/ (historial)
  - GET /api/v1/analytics/ (estadístiques)
  - Supabase Table Editor (opcional, per debug)
```

---

## Resum del pla complet

| Fase | Què | Punts de les proves | Estimació | Branca | Risc |
|------|-----|---------------------|-----------|--------|------|
| **B** | Distància de passeig | 3 | 2-3h | `feat/walk-distance` | ⏳ Ajornada |
| **C+D** | Reorganitzar dashboard owner + mapa | 4, 5 | 2-3h | `refactor/reorganitzacio-dashboard` | Baix-Mitjà |
| **E** | Capacitor per /patient | 1, 2, 6 | 3-5 dies | `feat/capacitor-patient-app` | Alt |
| **F** | Lògica adaptativa GPS | 7 | 30 min | `feat/gps-adaptive-logic` | Molt baix |
| **G** | Migració a PostgreSQL | 8 | 1-2 dies | `feat/postgresql-migration` | Mitjà |

**Ordre recomanat:** ✅F → C+D → G → E

(F completada. B ajornada a post-beta. C+D substitueix les fases originals per la reorganització del dashboard. G (PostgreSQL) abans de E (Capacitor) per tenir dades persistents quan comencin les proves reals amb Capacitor.)

**Nota sobre analytics:** El backend ja exposa `GET /analytics/` amb `avg_duration_minutes`, `common_start_hours` (top 3) i `walk_frequency` (7 dies). La informació d'horaris habituals **ja existeix** a l'API — la nova pàgina d'activitat la mostrarà sense acordió.
