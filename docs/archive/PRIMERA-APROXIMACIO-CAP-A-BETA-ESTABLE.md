<!-- ARXIVAT 2026-06-30: document històric. Veure docs/INDEX.md per la documentació activa. -->

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

Branca de seguretat: `safety/pre-bcrypt-fix` — ❌ ESBORRADA (era un experiment no fusionat)

---

## Fase B — Distància de passeig (Punt 3) — ❌ CANCEL·LADA (31/05/2026)

**Problema original:** La columna distància a l'historial de passejades sempre mostra `--`. El backend mai calcula ni emmagatzema la distància recorreguda.

**Decisió (31/05/2026):** **Cancel·lada definitivament.** La distància recorreguda no respon a una necessitat real del cuidador. El que importa és: va sortir? (historial), quant de temps? (durada), per on va anar? (mapa), a quines hores acostuma a sortir? (analítiques). La distància és una mètrica esportiva, no de tranquil·litat familiar.

**Canvis aplicats:**
- Columna "Distància" eliminada de `WalkHistoryList/index.tsx`
- `distance_meters` eliminat de la interfície `WalkHistoryItem` (`walkService.ts` i `WalkHistoryList/index.tsx`)
- La funció Haversine a `frontend/lib/gpsUtils.ts` es manté per si es necessita en el futur

---

## Fase C + D — Reorganització completa del dashboard owner (Punts 4 i 5) — ✅ COMPLETADA (31/05/2026)

**Implementat a la branca:** `feat/dashboard-reorganization` (mergejat a `develop` i `main`)
**Commit:** `557ff3c`

### Resum dels canvis

| Ruta | Abans | Després |
|------|-------|---------|
| `/caregiver` | Mapa + estat + historial | Mapa + estat *només* |
| `/caregiver/dashboard` | SOS + codi + historial + analytics | SOS + codi + **afegir cuidador** *només* |
| `/caregiver/activity` | ❌ No existia | **NOVA:** historial + analytics sense acordió |

### Fitxers modificats (10) + creat (1)

| Fitxer | Canvi |
|--------|-------|
| `CustomIcons.ts` | Punt actual `success` (verd) + 20px; punt offline 20px |
| `PatientStatusCard.tsx` | Treure "Punts de ruta" |
| `CaregiverHeader.tsx` | Títol per prop, sense botó "Afegir cuidador" |
| `OwnerMenuDrawer.tsx` | 3 opcions: `MapPin`, `Sliders`, `BarChart3` |
| `CaregiverDashboardLayout.tsx` | Sense `inviteModal` |
| `CaregiverDashboard/index.tsx` | Sense `InviteCaregiverModal` |
| `CaregiverAnalytics.tsx` | Sense acordió, sempre visible |
| `dashboard/page.tsx` | Només SOS + codi + cuidadors |
| `WalkHistoryList/index.tsx` | Columna Distància eliminada |
| `walkService.ts` | `distance_meters` eliminat del tipus |
| **Nou:** `activity/page.tsx` | Historial + analytics, protegit per owner |

**Build:** ✅ `npm run build --webpack` correcte
**Tests:** ✅ 108 passed / 6 skipped
**Desplegat a Vercel des de `main`**

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

## Criteris d'èxit de la beta estable — Progrés

| # | Criteri | Fase | Estat |
|---|---------|------|-------|
| 1 | Cuidador veu historial amb ruta al mapa, durada i horaris | C+D | ✅ |
| 2 | Dashboard separa configuració d'activitat | C+D | ✅ |
| 3 | GPS en background sense falsos offline (Capacitor) | E | ⏳ |
| 4 | Cuidador rep SOS si té el dashboard obert | — | ✅ (ja funciona) |
| 5 | Dades persisteixen entre restarts (PostgreSQL) | G | ✅ |
| 6 | Consulta externa de la BD | G | ✅ |

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

## Fase G — Migració a PostgreSQL (Punts 3, 5 i 8) — ✅ COMPLETADA (31/05/2026)

**Implementat a la branca:** `feat/postgresql-migration` (mergiat a `develop` i `main`)
**Document de referència:** `docs/FASE-G-POSTGRESQL-MIGRATION.md` (pla detallat)

**Problema original:** SQLite a Render no persisteix entre restarts i no es pot consultar externament.

**Solució aplicada:** PostgreSQL gestionat per Supabase (gratuït) amb connexió via Supavisor pooler (IPv4).

### Resum dels canvis

| Subfase | Què | Estat |
|---------|-----|-------|
| G.1 | `psycopg2-binary` a requirements | ✅ |
| G.2 | `database.py` compatible (zero canvis) | ✅ |
| G.3 | `DateTime(timezone=True)` a tots els models | ✅ |
| G.4 | Supabase projecte creat a `cduokeaobbsdjnckuuxk` (eu-west-1) | ✅ |
| G.5 | `DATABASE_URL` configurat a Render (pooler IPv4) | ✅ |
| G.6 | Verificació de connexió + desplegament | ✅ |
| G-extra | SHA-256 hashing + 2h expiry per codis d'activació | ✅ |

### G-extra: SHA-256 hashing de codis d'activació i invitació

**Motiu:** Emmagatzemar codis en text pla a la BD (com abans) exposava les dades a un potencial leak.

**Canvis aplicats:**
- `Patient.activation_code_hash`: SHA-256 del codi (no text pla)
- `Patient.activation_code_expires_at`: 2h de validesa
- `InvitationCode.code`: `String(6)` → `String(64)` per SHA-256
- `POST /auth/activate-device`: lookup per hash, 410 si expirat
- `GET /auth/patient/activation-code`: regenera si NULL/expirat/usat
- `ActivationCodeResponse`: +`expires_at`

**Tests:** ✅ 152 passats backend / 10 WS preexistents

### Impacte arquitectònic

| Aspecte | Abans | Després |
|---------|-------|---------|
| BD Producció | SQLite (Render disk) → perd dades al restart | PostgreSQL (Supabase) → persistent |
| Connexió | Directa a SQLite | Supavisor pooler (IPv4, port 5432) |
| URI pooler | — | `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres` |
| Dades locals | `pathguard.db` (SQLite, dev) | Es manté per dev local + tests |
| SSL | No | `require` per pooler |

**Branca:** `feat/postgresql-migration`
**Estimació:** 1-2 dies (complert)
**Risc:** Mitjà (superat)

---

## Resum del pla complet

| Fase | Què | Punts de les proves | Estimació | Branca | Risc | Estat |
|------|-----|---------------------|-----------|--------|------|-------|
| **F** | Lògica adaptativa GPS | 7 | 30 min | `feat/gps-adaptive-logic` | Molt baix | ✅ |
| **C+D** | Reorganitzar dashboard owner + mapa | 4, 5 | 2-3h | `feat/dashboard-reorganization` | Baix-Mitjà | ✅ |
| **G** | Migració a PostgreSQL | 8 | 1-2 dies | `feat/postgresql-migration` | Mitjà | ✅ |
| **E** | Capacitor per /patient | 1, 2, 6 | 3-5 dies | `feat/capacitor-patient-app` | Alt | ⏳ |
| **B** | Distància de passeig | 3 | — | — | — | ❌ Cancel·lada |

**Ordre d'execució:** ✅F → ✅C+D → ✅G → **E** (ara)

**Nota sobre B:** Cancel·lada per decisió de producte. La columna distància i `distance_meters` han estat eliminats de la UI i del tipus frontend.

---

## Pendents de decidir — Nous temes sorgits durant la revisió (01/06/2026)

### Tema 1: `full_name` del cuidador — ✅ DECIDIT

**Problema:** La columna `full_name` al model `User` (`backend/app/api/users/models.py`) sempre és `NULL`. El registre no recull el nom del cuidador en cap moment.

**Decisió:** Opció A — un sol camp `full_name` (no dividir en `first_name` + `last_name`). Motiu:
- Ja existeix a la BD — zero migració
- Evita problemes amb cognoms compostos catalans/castellans
- PathGuard no fa cartes formals ni factures
- Al formulari: "El teu nom complet (Cuidador)"

**Pendent d'implementar:**
- [ ] `RegisterRequest.full_name: str` (Pydantic schema)
- [ ] `register_family(..., full_name)` → `User(full_name=full_name)`
- [ ] Camp al `RegistrationForm` (frontend)
- [ ] `LoginResponse` pot incloure `full_name` per mostrar-lo al header

### Tema 2: Landing page ampliada (explicació + privacitat) — ✅ DECISIÓ DE CONCEPTE

**Problema:** La landing page actual (`/`) només mostra 3 botons. No hi ha explicació del projecte ni informació de privacitat. Cap esment a cookies (no n'hi ha) ni consentiment.

**Decisió:** Ampliar la landing page amb seccions en lloc de crear pàgines separades. Estructura proposada:

#### Secció 1 — Hero (sense canvis)
Títol + 3 CTAs: Crear entorn, Activar dispositiu, Accedir com a cuidador.

#### Secció 2 — Com funciona
4 icones horitzontals (a mòbil: 2x2): Crea l'entorn → Activa dispositiu → Segueix la ruta → SOS si cal. Text breu explicatiu.

#### Secció 3 — Privacitat i dades
Targetes informatives amb icones:
- **Ubicació:** Només durant el passeig
- **Correu:** Per al registre
- **Seguretat:** Servidors a Europa
- **Drets:** Baixa total de dades

Text de fons: *"No emmagatzemem dades quan no hi ha un passeig actiu. No compartim informació amb tercers. Pots sol·licitar l'eliminació de totes les dades en qualsevol moment."*

#### Secció 4 — Què NO és PathGuard
```
❌ No és vigilància 24/7
❌ No és un dispositiu mèdic
❌ No venem ni compartim dades
❌ El control sempre és del familiar: només ell pot iniciar 
   i aturar un passeig. El cuidador no pot reactivar-lo.
❌ No hi ha tracking quan el familiar no està de passeig
```

**Filosofia:** PathGuard és una eina de tranquil·litat, no de control.

#### Secció 5 — CTAs (repetició opcional al final)

**Consentiment al registre:** Enllaç visible a la landing page + confirmació implícita al fer clic a "Crear entorn". Sense banner de cookies (no n'hi ha).

**Pendent de validar:**
- [ ] L'estructura i seccions agraden al product owner
- [ ] La secció "Què NO és" té el to adequat
- [ ] Confirmació al registre: checkbox o consentiment implícit?

### Tema 3: WalkDetailModal — ⏳ EN REVISIÓ

**Problema:** El modal de detall del passeig (`WalkDetailModal.tsx`) mostra un mapa amb la ruta. Es va qüestionar si:
- Genera imatges del mapa (NO — renderitza Leaflet dinàmic, client-side, 0KB emmagatzemats)
- És redundante amb la llista d'historial (que ja mostra data, hora, durada)
- Dona sensació de "massa control"

**Decisió (01/06/2026):** Es manté l'opció actual (mapa dinàmic) per ara. Pendent de revisar en el futur:
- Opció 1: Eliminar-lo (la llista d'historial ja dona la informació)
- Opció 2: Mantenir-lo amb mapa (actual — per veure la ruta concreta de tant en tant)
- Opció 3: Transformar-lo en una altra funcionalitat

### Tema 4: i18n — ajornat (post-Beta)

### Tema 5: Capa nativa (Capacitor /patient) — blocat (Xcode pendent)

### Què cal per tornar a engegar

1. Concretar el disseny de la landing page (maqueta visual real)
2. Decidir si es vol checkbox de consentiment al registre o consentiment implícit
3. Implementar `full_name` al registre (frontend + backend)
4. Implementar landing page ampliada
5. Reprendre Fase E (Capacitor) — instal·lar Xcode
6. Decidir futur de WalkDetailModal (revisar més endavant)
7. Completar Beta Deploy checklist
