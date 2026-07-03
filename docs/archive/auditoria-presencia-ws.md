<!-- ARXIVAT 2026-06-30: document històric. Veure docs/INDEX.md per la documentació activa. -->

# AUDITORIA — PRESÈNCIA EN DOZE I MODEL DE PRESÈNCIA HÍBRID

**Data:** 2026-06-04  
**Autor:** Staff Software Engineer (Android OS Internals, Mobile Networking, Distributed Systems)  
**Àmbit:** Anàlisi del disconnect WebSocket code=1006 en screen-off, comportament d'Android Doze/Standby, WebView suspension, JS timer throttling, foreground services, i proposta de model de presència robust que no depengui exclusivament del WebSocket.

---

## 1. ABAST

Anàlisi del flux complet de presència:

```
Patient App (PWA + WebView + Foreground Service)
  → WebSocket heartbeat (JS → WS → Backend)
  → HTTP locations (Plugin natiu → HTTP API)
  → Backend ConnectionManager
    → is_patient_online()
    → WebSocket broadcast (patient_online/patient_offline)
      → Caregiver Frontend
```

Objectiu: comprendre què passa realment quan la pantalla s'apaga, per què el WebSocket mor amb code 1006, i dissenyar un model de presència que funcioni correctament quan el JS està throttled però el Foreground Service continua enviant dades per HTTP.

---

## 2. ARQUITECTURA ACTUAL DE PRESÈNCIA

```
Patient dispositiu
     │
     ├── WebSocket (JS) ←── ping/pong cada 30s
     │     └── ConnectionManager.is_patient_online()
     │           └── WS alive → ONLINE
     │           └── WS dead  → OFFLINE (fals)
     │
     └── HTTP POST /locations/batch (Plugin natiu)
           └── location_service.save_batch()
                 └── NO actualitza presència
```

**Problema central:** El backend només consulta l'estat del WebSocket per determinar si el pacient està online. Quan el JS del WebView es congela per Doze, el WS mor (code 1006), però el Foreground Service pot continuar enviant coordenades GPS per HTTP correctament.

---

## 3. ANÀLISI DETALLADA: QUÈ PASSA QUAN LA PANTALLA S'APAGA

### T=0 — Screen off

- `visibilitychange` → document `hidden=true`
- Android inicia Doze preparation (fase lleugera)
- Foreground Service (tipus `FOREGROUND_SERVICE_LOCATION`) **continua executant-se** — té prioritat màxima per `startForeground`, Android no el killing durant Doze normal
- `FusedLocationProviderClient` continua donant GPS fixes (hardware GPS bypassa Doze parcialment)
- **WebView JS:** `setTimeout`/`setInterval` comencen a ser throttled per Chrome/Android WebView (fins a 1 cop per minut en Doze profund)
- **WebSocket heartbeat:** JS no pot enviar pong perquè els timers estan throttled
- Backend: després de ~20-30s sense pong → tanca WebSocket amb **code 1006** (normal close / timeout)

### T+5 minuts

- Doze moderat
- Foreground Service: **ENCARA EN MARXA** (Android no mata foreground services amb notificació visible en Doze normal)
- GPS: operatiu (a nivell chipset, FusedLocationProviderClient)
- Plugin HTTP: **funciona** — les crides HTTP des del Foreground Service NO estan throttled (codi Java natiu, no JS)
- WebView: JS timers 1/min, WebSocket MORT (code 1006)
- **Caregiver:** `ConnectionManager` emet `patient_offline` (WS tancat) — **FALS POSITIU**

### T+30 minuts

- Deep Doze
- Foreground Service: ENCARA EN MARXA a stock Android. **RISC:** Xiaomi/MIUI, Huawei, Samsung poden matar-lo malgrat ser foreground (OEM battery optimizers agressius)
- GPS: pot suspendre's en alguns xipsets (Qualcomm menys problemes que MediaTek)
- Plugin HTTP: si el servei viu, les dades GPS S'ENVIEN correctament per HTTP cada 5-30s
- WebView: pot ser suspès per l'OS, o alive però sense JS funcional
- **Caregiver:** veu OFFLINE des de T+30s, malgrat que el pacient continua enviant dades GPS

### T+2 hores

- Extreme Doze
- Foreground Service: viu a stock Android, **MORT a MIUI/Huawei** (RISC OEM alt)
- Plugin: si viu, buffer `ConcurrentLinkedQueue` max 100 punts → overflow → punts antics perduts
- GPS: pot estar completament suspès en deep Doze
- WebView: probablement suspès
- **Caregiver:** OFFLINE (correcte si el servei ha mort, incorrecte si encara envia GPS)

---

## 4. TROBALLES

### 4.1 WebSocket i Presència

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **P1** | **P0** | `ConnectionManager.is_patient_online()` només comprova WS. HTTP location recent no compta com a keepalive. | **Fals offline** quan pantalla apagada però GPS continua | **Alta** (sempre en background) | Backend: si HTTP location rebut <30s, tractar com a online. Modificar `ConnectionManager` per comprovar recència de HTTP location. | Mitjà |
| **P2** | **P1** | `WS_MAX_RECONNECT_ATTEMPTS = 5` (25s total). Si WS mor per Doze, frontend fa 5 intents i abandona. | WS permanentment mort fins que usuari obri l'app | **Alta** (cada screen-off) | Infinite retry amb backoff: 5 intents ràpids (1s, 2s, 4s, 8s, 16s) + 30s indefinit. | Baix |
| **P3** | **P1** | Heartbeat JS-dependent. Quan WebView JS està throttled, heartbeat no funciona. | Backend no pot distingir entre "pausa curta" i "offline real" | **Alta** (cada screen-off) | Dual heartbeat: (1) WS ping/pong per presència en foreground, (2) HTTP `/heartbeat` des del Foreground Service cada 30s. | Mitjà |

### 4.2 Foreground Service i OEM

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **P4** | **P0** | Foreground Service sense `walkId` persistent. `START_STICKY` reinicia amb `intent=null` → `walkId=0`. | Pèrdua total de tracking després de kill d'app per OEM | **Mitjana** (OEMs agressius) | Persistir `walkId` a `SharedPreferences`, recuperar en `onStartCommand` amb `intent=null`. | Baix |
| **P5** | **P2** | Foreground Service no té protecció OEM (Xiaomi, Huawei, Samsung). | Servei matat per battery optimizer després de 30-60min background | **Mitjana** (depèn d'OEM) | Guies OEM per a cada fabricant. `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. `START_STICKY` + `wakeLock`. | Alt |
| **P6** | **P2** | GPS pot suspendre's en deep Doze en alguns chipsets (MediaTek). | Forats a la ruta durant Doze profund | **Mitjana** | Acceptable (bateria > dades). Foreground Service ho minimitza. | - |

### 4.3 Backend i Model de Presència

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **P7** | **P1** | Backend no emet esdeveniments `patient_status` alternatius (només online/offline). Caregiver no pot saber si és "online per GPS" o "incert". | Caregiver veu offline incorrecte sense context | **Alta** (sempre en background) | Emetre 4 estats via WS: `online`, `gps_online`, `limbo`, `offline`. Caregiver mostra indicador de 4 colors. | Mitjà |
| **P8** | **P2** | `ConnectionManager` no exposa mètode per actualitzar `last_http_location_at`. | No hi ha punt d'entrada per marcar presència des de HTTP | **Alta** | Afegir `update_http_presence(group_id)` a `ConnectionManager`. Cridar des de `location_service.save_batch()`. | Baix |

---

## 5. TAULA RESUM DE TROBALLES

| ID | Classificació | Problema | Impacte | Probabilitat | Esforç |
|---|---|---|---|---|---|
| **P1** | **P0** | `is_patient_online()` només comprova WS | Fals offline en background | Alta | Mitjà |
| **P4** | **P0** | `walkId` no persistit al Foreground Service | Pèrdua total de tracking després de kill OEM | Mitjana | Baix |
| **P2** | **P1** | 5 reconnect attempts insuficients | WS mort permanent | Alta | Baix |
| **P3** | **P1** | Heartbeat JS-dependent | No distingir pausa vs offline | Alta | Mitjà |
| **P7** | **P1** | Només 2 estats de presència (online/offline) | Caregiver sense context | Alta | Mitjà |
| **P5** | **P2** | Sense protecció OEM battery optimizer | Servei matat en OEMs agressius | Mitjana | Alt |
| **P8** | **P2** | `ConnectionManager` no rep HTTP presence | Sense punt d'entrada HTTP | Alta | Baix |
| **P6** | **P2** | GPS pot suspendre's en deep Doze (MediaTek) | Forats a la ruta | Mitjana | - |

---

## 6. PROPOSTA DE MODEL DE PRESÈNCIA ROBUST (4 ESTATS + DUAL HEARTBEAT)

### 6.1 State Machine

```
┌─────────────────────────────────────────────────────────┐
│                  Presence State Machine                   │
│                                                          │
│  WS heartbeat < 30s  ───────────────── ONLINE (verd)     │
│  (JS actiu, temps real)                                  │
│                                                          │
│  WS dead BUT HTTP location < 60s ── GPS-ONLINE (blau)    │
│  (GPS actiu, sense JS. Caregiver: "online (GPS)")        │
│                                                          │
│  WS dead AND HTTP location 60-300s ── LIMBO (gris)       │
│  (No sabem si és offline o Doze profund.                 │
│   Caregiver: "incert")                                   │
│                                                          │
│  WS dead AND HTTP location > 300s ── OFFLINE (vermell)   │
│  (Realment offline)                                      │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Canvis al ConnectionManager (Backend)

```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.last_http_location_at: dict[str, datetime] = {}

    def update_http_presence(self, group_id: str) -> None:
        """Cridat des de location_service.save_batch()"""
        self.last_http_location_at[group_id] = datetime.utcnow()

    def is_patient_online(self, group_id: str) -> str:
        ws_alive = group_id in self.active_connections
        last_http = self.last_http_location_at.get(group_id)
        now = datetime.utcnow()

        if ws_alive and (not last_http or (now - last_http).seconds < 30):
            return "online"
        if not ws_alive and last_http and (now - last_http).seconds < 60:
            return "gps_online"
        if not ws_alive and last_http and (now - last_http).seconds < 300:
            return "limbo"
        return "offline"
```

### 6.3 Canvis al location_service.py

```python
# A save_batch(), després de desar els punts:
await connection_manager.update_http_presence(patient.group_id)

# I després, si l'estat ha canviat respecte a l'última emissió:
new_status = connection_manager.is_patient_online(patient.group_id)
if new_status != last_emitted_status[patient.group_id]:
    await broadcast_status_change(patient.group_id, new_status)
```

### 6.4 Dual Heartbeat Strategy

**Actual (trencat):**
```
Backend envia ping cada 30s → JS respon pong → OK
Backend envia ping → JS throttled (Doze) → no respon → timeout (code 1006)
```

**Proposat:**
```
1. WS ping/pong (quan JS està actiu)
   Backend → JS: ping cada 30s
   JS → Backend: pong
   Propòsit: detecció ràpida de foreground

2. HTTP keepalive (des del Foreground Service)
   Plugin → Backend: POST /heartbeat { device_token } cada 30s
   Backend: actualitza last_http_location_at[group_id]
   Propòsit: presència independent de JS

   Aquesta crida NO depèn de JS. El Foreground Service
   en Java pot fer HTTP directament.
```

### 6.5 Reconnect Strategy (Frontend)

```typescript
let attempt = 0;
const MAX_FAST_ATTEMPTS = 5;

while (true) {
  try {
    await connectWebSocket();
    attempt = 0;
  } catch (error) {
    attempt++;
    if (attempt <= MAX_FAST_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
      await sleep(delay);
    } else {
      await sleep(30000);
    }
  }
}
```

### 6.6 Indicador de Presència al Caregiver Frontend

```typescript
type PresenceStatus = "online" | "gps_online" | "limbo" | "offline";

const STATUS_CONFIG = {
  online:     { color: "success", label: "En línia", icon: "circle" },
  gps_online: { color: "primary", label: "GPS actiu", icon: "satellite" },
  limbo:      { color: "warning", label: "Incert", icon: "help-circle" },
  offline:    { color: "danger",  label: "Fora de línia", icon: "offline" },
};
```

---

## 7. DEPENDENCIES ENTRE TASQUES

```
Fase 1 (P0)
  └── P1 (Model presència multi-font) → independent
  └── P4 (walkId persistent) → independent

Fase 2 (P1)
  └── P2 (Infinite WS retry) → independent
  └── P3 (Dual heartbeat) → dependent de P1
  └── P7 (4 estats de presència) → dependent de P1

Fase 3 (P2)
  └── P5 (Protecció OEM) → independent
  └── P8 (ConnectionManager HTTP entry) → dependent de P1
  └── P6 (GPS Doze) → dependent de P4
```

---

## 8. ESTIMACIÓ D'ESFORÇ TOTAL

| Fase | Troballes | Esforç estimat |
|---|---|---|
| Fase 1 (P0) | 2 | 1-2 dies |
| Fase 2 (P1) | 3 | 2-3 dies |
| Fase 3 (P2) | 3 | 2-3 dies |
| **Total** | **8** | **5-8 dies** |

---

## 9. ESCENARIS DE SIMULACIÓ

### Escenari A: Screen off, stock Android (Pixel)

1. T=0: Screen off → JS throttled → WS ping timeout → code 1006
2. **ConnectionManager:** `is_patient_online()` = `offline` (WS dead) ❌
3. Foreground Service: **continua enviant GPS per HTTP** cada 5s
4. T+5s: `location_service.save_batch()` rep dades
5. **Amb fix:** `update_http_presence()` actualitza `last_http_location_at`
6. **ConnectionManager:** `is_patient_online()` = `gps_online` ✅
7. Caregiver: "GPS actiu" (blau) — correcte
8. T+30min: usuari obre l'app → JS descongelat → WS reconnecta (infinite retry) → `online` (verd)

### Escenari B: Screen off, MIUI (Xiaomi Redmi)

1. T=0: Screen off → JS throttled → WS mor
2. T+30min: MIUI battery optimizer **mata el Foreground Service**
3. `START_STICKY` reinicia amb `intent=null` → `walkId=0` (P4)
4. GPS aturat, HTTP aturat
5. T+31min: cap dada rebuda → `last_http_location_at` > 300s → `offline` ✅
6. T+60min: usuari obre l'app → app reinicia → WS reconnecta
7. **Problema:** `walkId` perdut → el walk no es reprèn → forat de 30min a la ruta
8. **Amb fix P4:** `SharedPreferences` guarda `walkId` → servei reinicia amb walk correcte

### Escenari C: Alternança ràpida screen on/off

1. T=0: Screen on → WS connectat → `online`
2. T+10s: Screen off → JS throttled → WS mor
3. T+15s: Screen on → JS descongelat → WS retry (infinite backoff, encara en fase ràpida 1-2s)
4. T+17s: WS connecta → `online` ✅
5. HTTP keepalive: durant els 15s de forat, plugin envia GPS → `gps_online` durant el forat
6. Transició fluida: `online` → `gps_online` → `online` ✅

---

## 10. MÈTRIQUES D'ÈXIT

| Mètrica | Actual | Objectiu |
|---|---|---|
| Falsos offline durant screen-off | **Sempre** (100%) | **0%** (GPS-ONLINE o ONLINE amb dual heartbeat) |
| Temps per detectar offline real | ~30s (WS timeout) | ~30s (WS) o ~300s (HTTP) per confirmació real |
| Reconnect després de Doze | **Mai** (5 intents, abandonat) | **Sempre** (infinite retry, màxim 30s entre intents) |
| Walk reprès després de kill OEM | **Mai** (walkId=0) | **Sempre** (SharedPreferences walkId) |
| Caregiver obté context de desconnexió | **Mai** (online/offline binari) | **Sempre** (4 estats + indicador visual) |
| Heartbeat en background | **Mort** (JS-dependent) | **Viu** (HTTP keepalive des de plugin natiu) |

---

*Document generat per auditoria de presència en Doze i model de presència híbrid PathGuard. Versió 1.0 — 2026-06-04.*
