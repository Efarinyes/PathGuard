# Eliminació del Monitoreig de Bateria — Safari/iOS Incompatibility Blocker

**Branca:** `fix/safari-battery-api-blocker`  
**Data:** 2026-05-19  
**Estat:** Aplicat i verificat

---

## Problema

La Battery Status API (`navigator.getBattery()`) no està disponible en Safari (macOS i iOS). Quan el pacient obria `/patient` en Safari, es produïa la següent cascada:

1. `useBatteryMonitoring` detectava que l'API no estava disponible i entrava al branch `else`
2. El callback `onStatusUpdate` es passava com a dependència de l'`useEffect` — com que es creava com a arrow function inline, era una referència nova a cada render
3. Cada re-render del component (cada posició GPS, cada 2-5 segons durant un passeig) re-executava l'effecte, creant i destruint `setInterval`, tornant a cridar `console.debug` i `onStatusUpdate(-1, false)`
4. La consola s'omplia de warnings constants, el JS thread no podia processar l'acció d'aturar el passeig (`handleStopWalk`), i l'ordinador s'escalfava

** símptomes en Safari:**
- Consola inundada de missatges `[Battery] Battery Status API not supported`
- Botó "Parem!" no responia (el fetch no es completava)
- GUI bloquejat, accions延缓ades
- Escalfament del dispositiu

## Decisió: eliminar vs. reparar

| Opció | Pros | Contres |
|-------|------|---------|
| **Eliminar bateria** | Elimina tot el deute tècnic. Zero maint. Zero bugs per navegador. Alineat amb la filosofia del producte (calm, discreet, reliable). | El cuidador no veu el % de bateria del pacient. |
| Reparar hook | Conserva la funcionalitat per Chrome/Firefox. | Deute tècnic permanent per un navegador. UA sniffing és fràgil. Safari = 25% mercat mòbil. Falta de confiabilitat (browsers poden mentir sobre la bateria). Complexitat afegida sense valor real. |

La bateria no és crítica per PathGuard. El producte valora "estan segurs ara mateix?" — no "quin percentatge de bateria tenen?". Eliminar alinea amb PD-2 de l'auditoria de producte: la informació ha de ser essencial, no passiva.

## Canvis aplicats

### Fitxers eliminats (2)
- `frontend/hooks/useBatteryMonitoring.ts` — Hook de monitoreig de bateria
- `backend/tests/integration/test_battery_ws.py` — Tests d'integració WS de bateria

### Fitxers modificats (10)

| Fitxer | Canvi |
|-------|-------|
| `frontend/components/PatientWalkController/index.tsx` | Eliminat import + bloc `useBatteryMonitoring` |
| `frontend/lib/WalkEventProcessor.ts` | Eliminat `DeviceStatus`, `DeviceStatusMessage`, `deviceStatus` de `WalkState`, `DEVICE_STATUS_UPDATE` action i reducer case |
| `frontend/hooks/useLivePatientLocation.ts` | Eliminat `deviceStatus` de l'estat i dispatch `DEVICE_STATUS_UPDATE` |
| `frontend/components/CaregiverDashboard/PatientStatusCard.tsx` | Eliminat props `deviceStatus`/`batteryTimeAgo` i secció "Estat de la bateria" |
| `frontend/components/CaregiverDashboard/index.tsx` | Eliminat `deviceStatus`, `batteryTimeAgo`, `formatBatteryTime` |
| `frontend/lib/formatTimeAgo.ts` | Eliminat funció `formatBatteryTime` |
| `backend/app/api/websocket/websocket_endpoint.py` | Eliminat branch `device_status_update` i import `datetime/timezone` |
| `backend/app/api/websocket/presence_tracker.py` | Eliminat `update_device_status` i `get_device_status` |
| `backend/app/api/websocket/connection_manager.py` | Eliminat `_patient_device_status_store` i propietat `patient_device_status` |
| `backend/app/api/websocket/snapshot_service.py` | Eliminat `device_status` del snapshot i import `_patient_device_status_store` |

## Impacte

- **Frontend:** El `PatientStatusCard` del cuidador ja no mostra la secció "Estat de la bateria". Es mostra la connexió del pacient, l'última actualització i els punts de ruta.
- **Backend:** El WS endpoint del pacient ara només processa `heartbeat`. Missatges `device_status_update` (d'un client antic) són ignorats silenciosament — zero breakage retroactiu.
- **Tests:** 152/152 passen. 10 failures preexistents de WebSocket timing (no relacionats).

## Verificació en viu

- Safari: `/patient` → iniciar passeig → botó "Parem!" funcional, zero console warnings, zero escalfament
- Brave/Chrome: comportament idèntic sense la secció de bateria
- Caregiver: `PatientStatusCard` mostra estat de connexió, última actualització i punts de ruta — sense bateria

## Referències

- Auditoria de producte: `PD-2` (informació quan es necessita, no passivament)
- Auditoria tècnica: Hook composició correcta però dependència `onStatusUpdate` inestable
- Apple WebKit Blog: [Battery Status API removed from Safari](https://webkit.org/blog/11962/new-webkit-features-in-safari-16-4/)