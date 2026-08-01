---
id: tech-SPEC-185
title: Honest HTTP presence when patient WebSocket dies
type: tech
status: implementing
priority: P0
created: 2026-08-01
author: tech-lead
agents_affected:
  - backend
  - frontend
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: null
---

# Spec: Honest HTTP presence when patient WebSocket dies

## 1. Objectiu

Quan el WebSocket del patient mor (kill app, WebView suspesa, timeout heartbeat) però el natiu encara envia `POST /locations/batch`, el caregiver ha de veure **`gps_online`** (o `limbo`/`offline` segons antiguitat HTTP), **no** un `patient_offline` forçat que pinta tot taronja “Sense cobertura”.

## 2. Context

Pla de reactivació: Metric B (UI taronja) amb Metric C (mapa avança) indica bug de **presència**, no de GPS.

Avui [`websocket_endpoint.py`](../backend/app/api/websocket/websocket_endpoint.py) en disconnect/timeout fa:

```python
set_patient_offline(...)
broadcast {"type": "patient_offline"}
```

El frontend tracta `patient_offline` com a `offline` absolut ([`useLivePatientLocation.ts`](../frontend/hooks/useLivePatientLocation.ts)).

Mentrestant `get_presence_status()` ja calcula `online | gps_online | limbo | offline` usant `patient_connections` + `last_http_location_at` (SPEC-170). El snapshot encara usa `get_patient_status()` binari.

## 3. Problema

1. Event legacy `patient_offline` sobreescriu la UX de 4 estats.
2. Timeout de heartbeat **no treu** el socket de `patient_connections` → `get_presence_status` pot seguir dient `online` si es crida després.
3. Snapshot menteix amb store binari.

## 4. Impacte arquitectònic

- Backend: `websocket_endpoint.py`, `snapshot_service.py`, possiblement helper a `connection_manager.py`
- Frontend: mantenir handler `patient_offline` per compat, però deixar d’emetre’l des del backend (o mapar-lo a presence recomputada — preferible deixar d’emetre)
- Tests unitaris ConnectionManager / endpoint

## 5. Criteris d’acceptació

### AC-1 — Emitir `patient_status` en lloc de `patient_offline`
- [x] En disconnect del darrer patient WS: `broadcast_patient_status(group_id)`.
- [x] En timeout heartbeat: treure la connexió de `patient_connections` (disconnect), després `broadcast_patient_status`.
- [x] No broadcast de `{"type":"patient_offline"}` en aquests camins.

### AC-2 — Snapshot 4 estats
- [x] `build_snapshot_payload` usa `get_presence_status(group_id)`.

### AC-3 — Connect patient
- [x] En connect/heartbeat recovery: `set_patient_online` + broadcast `patient_online` **i** `broadcast_patient_status` (status `online`).

### AC-4 — Tests
- [x] Test: amb HTTP recent i sense WS → `get_presence_status` == `gps_online`.
- [x] Test: sense WS ni HTTP → `offline`.
- [x] Test: snapshot payload usa presence 4 estats (unit o integration).

### AC-5 — Cap regressió caregiver
- [ ] Kill app sense HTTP → caregiver acaba en offline/limbo (taronja), no verd fals. (field)
- [ ] Kill app amb FGS enviant batches → caregiver pot mostrar `gps_online` després del batch. (field)

### AC-6 — No enganxar-se a `limbo`
- [x] Frontend re-deriva presence per edat de l’última ubicació (`derivePresenceStatus`): >300s → `offline` («Sense cobertura»), encara sense nous events WS.

## 6. Riscos

- **R1:** Clients antics esperen `patient_offline` — mitigació: handler frontend es manté; nous events són `patient_status`.
- **R2:** Timeout sense tancar WS deixa connexió zombi — mitigació: AC-1 exigeix disconnect.

## 7. Pla d’implementació

**Branca:** mateixa que el pla de docs / o `fix/SPEC-185-honest-http-presence`

1. Backend: endpoint + snapshot + tests
2. Verificar frontend ja entén `patient_status`
3. Merge

## 8. Pla de validació

- pytest nous
- Smoke: kill app amb walk — si hi ha batches, UI → GPS actiu; si no, Sense cobertura

## 9. Out of scope

- SPEC-183 keepalive GPS
- SPEC-184 push force
- Canviar colors/labels de `PatientStatusCard` (ja té gps_online)

## 10. Referències

- `specs/tech-SPEC-170-caregiver-presence-http-broadcast.md`
- `backend/app/api/websocket/connection_manager.py`
- `docs/field-tests/TEMPLATE-reactivation-metrics.md`
