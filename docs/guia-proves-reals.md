# PathGuard — Guia de Proves Reals en Dispositius

## Resum

Proves amb dos dispositius reals: un mòbil per al pacient (GPS + PWA) i un ordinador o mòbil per al cuidador (monitorització via WebSocket).

---

## Requisits previs

- `micromamba` amb l'entorn `tracker-env` actiu
- Compte ngrok (gratuït amb email verificat per domini fixe)
- Dos dispositius a la mateixa xarxa o amb accés a Internet
- `pathguard.db` esborrada (reinici net després de la Fase 1)

---

## Backend — uvicorn

### 1. Activar l'entorn

```bash
micromamba activate tracker-env
```

### 2. Inicialitzar la base de dades (només la primera vegada)

```bash
cd backend
python init_db.py
```

Si ja tens una DB existent de la fase anterior i vols començar de zero:

```bash
rm backend/pathguard.db
python backend/init_db.py
```

### 3. Engegar el backend

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El backend estarà disponible a `http://localhost:8000`.

### 4. Verificar que funciona

```
http://localhost:8000/docs
```

Hauries de veure la documentació Swagger de l'API.

---

## Backend — ngrok (túnel públic)

ngrok crea una URL pública que redirigeix al teu backend local. Així els mòbils poden accedir a l'API desde Internet.

### 1. Instal·lar ngrok

```bash
# macOS
brew install ngrok
```

O descarrega des de https://ngrok.com/download

### 2. Autenticar (només la primera vegada)

```bash
ngrok config add-authtoken EL_TEU_TOKEN
```

El token el trobes a https://dashboard.ngrok.com/get-started/your-authtoken

### 3. Engegar el túnel

```bash
ngrok http 8000
```

ngrok mostrarà una pantalla amb:

```
Forwarding  https://a1b2c3ngrok-free.app -> http://localhost:8000
```

Aquesta URL és la teva `API_BASE_URL` per al frontend.

### Domini fixe (recomanat)

Amb un compte ngrok verificat (gratuït), pots reservar un domini fixe:

```bash
ngrok http 8000 --domain pathguard-dev.ngrok-free.app
```

Així no cal canviar l'env cada vegada que reinicies ngrok.

---

## Frontend — configuració

### Variables d'entorn

Crea o edita `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=https://a1b2c3ngrok-free.app
NEXT_PUBLIC_WS_BASE_URL=wss://a1b2c3ngrok-free.app/api/v1/ws
```

**Important:** Si canvies la URL de ngrok, cal actualitzar aquest fitxer i reconstruir.

### Engegar el frontend

Opció A — Desenvolupament (hot reload, més ràpid per iterar):

```bash
cd frontend
npm run dev
```

Opció B — Producció local (més proper al comportament real):

```bash
cd frontend
npm run build -- --webpack && npm start
```

El frontend estarà disponible a `http://localhost:3000`.

---

## Frontend — túnel (si cal accedir des d'un altre dispositiu)

Si necessites que el mòbil accedeixi al frontend per PWA (necessari per GPS):

```bash
ngrok http 3000
```

Això et donarà una segona URL pública per al frontend.

**Per a PWA:** Cal que el domini del frontend sigui accessible per HTTPS. ngrok ja ho proporciona.

---

## Prova completa — Pas a pas

### Escenari 1: Registre + activació (post-Fase 2)

1. **Cuidador (ordinador):** Obre `http://localhost:3000` → "Crear entorn familiar"
2. **Cuidador:** Omple el formulari (nom del grup, nom del pacient, email, contrasenya)
3. **Cuidador:** Veure el codi d'activació (ex: `A3K7M`) a la pantalla de confirmació
4. **Pacient (mòbil):** Obre `https://frontend-ngrok-url/activate`
5. **Pacient:** Introdueix el codi `A3K7M`
6. **Pacient:** Queda vinculat → pantalla `/patient` ("Comença a passejar")
7. **Cuidador:** Obre `https://frontend-ngrok-url/caregiver` → veu el pacient connectat

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
2. **Pacient:** Entra en un lloc sense cobertura (túnel, parking subterrani)
3. **Cuidador:** Veure "Passeig actiu - Sense cobertura" amb indicador taronja
4. **Pacient:** Surt del túnel, cobertura torna
5. **Cuidador:** Veure "Passeig actiu - En línia" amb indicador verd
6. **No hi ha cap mètrica de "pèrdua de cobertura" al dashboard** — només l'estat transitori

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

## Checklist de verificació post-Fase 2

- [ ] Backend engega sense errors
- [ ] `POST /auth/register` retorna `activation_code`
- [ ] `POST /auth/activate-device` funciona amb codi vàlid
- [ ] `POST /auth/activate-device` rebutja codi invàlid
- [ ] `POST /auth/activate-device` rebutja codi ja utilitzat
- [ ] `GET /patient/activation-code` funciona com a owner
- [ ] Registre → codi → activació → `/patient` funciona end-to-end
- [ ] El cuidador pot fer login i veure el dashboard
- [ ] El fluexit de passeig funciona (GPS, mapa, aturar)
- [ ] El chime SOS se sent (no l'alarma anterior)
- [ ] Pause monitoring no apareix
- [ ] WatchersCount no apareix
- [ ] SOS modal no mostra sos_count ni walk_id