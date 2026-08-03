<!-- ARXIVAT: Implementada / mergejada; arxivada 2026-08-03 (higiene specs) -->
---
id: tech-SPEC-170
title: Caregiver presence updates from HTTP batch uploads
type: tech
status: archived
priority: P0
created: 2026-07-06
author: tech-lead
agents_affected:
  - backend
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: 0004---

# Spec: Caregiver presence updates from HTTP batch uploads

## 1. Objectiu

Garantir que el cuidador (`/caregiver` a Brave en Mac) vegi correctament l'estat del pacient quan aquest envia punts via HTTP `/locations/batch`, sense dependre que el WebSocket del pacient estigui viu.

## 2. Context

Sessió 2026-07-06 (camp a iPhone 8 + Mac): el pacient transmet punts correctament quan recupera la connexió (la BD rep els punts, el mapa del cuidador reb els `location` events per WS), però el **panell d'estat** del cuidador queda persistentment en "Passeig actiu - Sense cobertura" (punt taronja). Només canvia quan el pacient tanca i obre l'app al mòbil (que reconnecta el WS).

Auditoria del codi (`backend/app/services/location_service.py`, `backend/app/api/websocket/connection_manager.py`) ha revelat la causa:

- Quan el pacient perd la cobertura, el seu WS es desconnecta → el backend envia `patient_offline` al cuidador → UI mostra "Sense cobertura".
- Quan el pacient recupera la cobertura, el seu WS **no reconnecta** (Bug A, fora d'abast d'aquesta spec — cobert per SPEC-160 i seguiment a fer).
- El pacient continua enviant HTTP correctament.
- Però `location_service.save_batch()` (línia 205) només crida `connection_manager.update_http_presence(...)` — **mai** crida `connection_manager.broadcast_patient_status(...)`.
- El mètode `broadcast_patient_status` existeix i està implementat correctament, però **no es crida enlloc** del codi (`grep -rn broadcast_patient_status` retorna només la definició).
- Per tant, el cuidador queda amb `presenceStatus = 'offline'` indefinidament fins que el pacient reconnecti el WS (cosa que a WKWebView no passa automàticament).

## 3. Problema

El `presenceStatus` del cuidador queda desfasat respecte l'estat real del pacient. La UI mostra "Sense cobertura" quan en realitat el pacient està enviant punts correctament.

## 4. Impacte arquitectònic

- **Backend:** 1 fitxer modificat — `backend/app/services/location_service.py`. Afegir una línia.
- **Frontend:** cap canvi.
- **iOS / Android natiu:** cap canvi.
- **Contracte WS:** no canvia (el mètode `broadcast_patient_status` ja existeix).
- **ADR referenciat:** ADR-0004 (única font de veritat d'estat de presència).

## 5. Criteris d'acceptació

- [ ] **AC-1:** `location_service.save_batch()` crida `await connection_manager.broadcast_patient_status(patient.group_id)` quan s'insereix correctament un batch.
- [ ] **AC-2:** Quan arriba un POST a `/locations/batch` amb èxit, tots els cuidadors connectats al WS del grup reben un missatge `{"type": "patient_status", "status": "gps_online", "group_id": N}`.
- [ ] **AC-3:** El status reflecteix correctament el temps des de l'últim HTTP rebut: `gps_online` (< 60s), `limbo` (< 300s), `offline` (> 300s), `online` (WS obert).
- [ ] **AC-4:** Tests backend: 152/152 + 1 test nou = 153/153 (o 152/152 si el test existent ja cobreix el cas).
- [ ] **AC-5:** Field test a iPhone 8 + Mac: quan /patient recupera la connexió, /caregiver canvia de "Sense cobertura" a "GPS actiu" o "En línia" en ≤ 5s sense tancar/reobrir cap app.
- [ ] **AC-6:** tsc --noEmit: 0 errors (no s'ha tocat frontend però es verifica per si de pas).
- [ ] **AC-7:** Tests Vitest: 124/130 (no s'ha tocat frontend).

## 6. Riscos identificats

- **R1:** Spam de broadcast si el pacient envia molts punts en poc temps — **mitigat** perquè cada broadcast és un sol missatge petit (status + group_id) i el WS ho gestiona bé. Si cal, es pot afegir un throttle.
- **R2:** El broadcast pot fallar si el cuidador ha tancat el WS — **mitigat** perquè `broadcast_to_group` ja gestiona errors (try/except per socket).
- **R3:** Race condition si el pacient tanca el WS just quan arriba un HTTP — **mitigat** perquè `broadcast_patient_status` ja comprova `patient_connections`.

## 7. Pla d'implementació

**Branca:** `fix/SPEC-170-caregiver-presence-http-broadcast` (des de `develop`)

| Ordre | Fitxer | Canvi |
|---|---|---|
| 1 | `backend/app/services/location_service.py` | Després de `connection_manager.update_http_presence(...)` (línia 205), afegir `await connection_manager.broadcast_patient_status(patient.group_id)`. |
| 2 | `backend/tests/integration/test_location_batching.py` (o similar) | Afegir 1 test que validi que quan s'insereix un batch via HTTP, els cuidadors connectats al WS reben un `patient_status` event. |

## 8. Pla de validació

- **Tests backend:** 152/152 + 1 test nou = 153/153.
- **tsc --noEmit:** 0 errors.
- **Field test (iPhone 8 + Mac):**
  - Escenari A: cuidador connectat, pacient recupera la connexió → cuidador veu canvi d'estat en ≤ 5s.
  - Escenari B: pacient connectat per WS → cuidador veu "En línia". Pacient perd WS → cuidador veu "GPS actiu" (no pas "Sense cobertura" perquè el HTTP encara funciona). Pacient recupera WS → cuidador veu "En línia" de nou.
  - Escenari C: pacient aturat 5 min → cuidador veu "Connectant..." (limbo). Pacient continua 5 min més → cuidador veu "Sense cobertura" (offline).
- **QA sign-off:** tots els AC verificats, field test documentat.

## 9. Out of scope

- **Bug A** (pacient iOS no reconnecta WS quan recupera la connexió): cobert per SPEC-160, seguiment separat. Aquesta spec NO resol el Bug A, però en redueix l'impacte perquè el cuidador ja veu l'estat correcte via HTTP.
- **NWPathMonitor equivalent per Android:** post-beta.
- **Refactor del `connection_manager`:** post-beta.

## 10. Referències

- [Auditoria sessió 2026-07-06] — causa arrel identificada.
- `backend/app/api/websocket/connection_manager.py:107-113` — definició de `broadcast_patient_status`.
- `backend/app/api/websocket/connection_manager.py:115-134` — definició de `get_presence_status` (granular).
- `backend/app/services/location_service.py:205` — punt on cal afegir el broadcast.
- `docs/decisions/0004-single-gps-source.md` (ADR-0004).
- SPEC-140, SPEC-150, SPEC-160 — altres correccions relacionades amb la captura de localització.

---

**Notes:**

- Aquesta spec NO toca frontend ni la capa nativa.
- El canvi és d'una sola línia al backend.
- El test del backend ja cobreix parcialment el cas (broadcast de location events); cal afegir el cas del `patient_status`.
- L'ordre d'implementació és important: 1 primer (canvi de codi), 2 després (test).
