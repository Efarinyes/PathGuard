<!-- ARXIVAT: APARCAT — no prioritat beta -->
---
id: feature-SPEC-184
title: Caregiver force location (push wake + flush)
type: feature
status: archived
priority: P2
created: 2026-08-01
author: tech-lead
agents_affected:
  - devops
  - backend
  - android
  - ios
  - platform-integration
  - frontend
reviewer: tech-lead
blocked_by:
  - tech-SPEC-183
replaces: null
supersedes: null
adr: null---

# Spec: Caregiver force location (DEFERRED)

## 1. Objectiu

Permetre al caregiver demanar “ubicació ara” quan el mapa porta estona sense punts: push data message → handler natiu al patient → one-shot GPS + flush del buffer.

## 2. Context

Pla de reactivació 2026-08-01: la forma menys invasiva i alineada amb PathGuard és el **keep-alive automàtic al patient** (SPEC-183). El force caregiver:

- Requereix FCM + APNs + tokens + UI + bridge nou
- Canvia el model mental (caregiver controla el dispositiu del patient)
- Quasi no s’usaria si SPEC-183 funciona

## 3. Estat de planificació

| Data | Decisió |
|---|---|
| 2026-08-01 | **APARCAT post-beta.** No implementar fins que SPEC-183 falli a camp OEM documentat, o producte demani explícitament l’escape hatch. |

**No és nord de beta.** No obrir branca d’implementació ara.

## 4. Problema (quan es desaparcqui)

Sense canal remot, el caregiver no pot despertar un FGS mort per OEM. Keep-alive local pot no bastar en fabricants agressius.

## 5. Impacte arquitectònic (futur)

- DevOps: Firebase / APNs secrets
- Backend: endpoint `POST /walks/{id}/force-location` + envio push
- Bridge: mètode nou coordinat (trenca immutabilitat → v3 + ADR)
- Android/iOS: handlers data message
- Frontend caregiver: botó només si estat offline/limbo i walk actiu

## 6. Criteris d’acceptació (futur)

- [ ] AC-1: ADR acceptat sobre push + privacitat (només walk actiu)
- [ ] AC-2: Android + iOS reben data message i fan flush + one-shot
- [ ] AC-3: Caregiver veu punt nou o error explícit en ≤30s
- [ ] AC-4: Zero acció si no hi ha walk actiu
- [ ] AC-5: Rate-limit (p.ex. 1/min) per evitar abús

## 7. Riscos

- **R1:** Complexitat cross-capa vs ROI — mitiga aparcant.
- **R2:** Enmascara fallades de SPEC-183 si es fa servir com a camí feliç.
- **R3:** Permisos i store review (push background).

## 8. Pla d’implementació

**No aplicar fins unblocking.** Quan es desbloquegi:

1. ADR push
2. Branca `feat/SPEC-184-caregiver-force-location`
3. Infra → backend → native → UI
4. Field OEM

## 9. Out of scope (sempre)

- Substituir keep-alive patient (SPEC-183 continua sent el default)

## 10. Referències

- Pla reactivació 2026-08-01
- `../tech-SPEC-183-android-walk-keepalive.md`
- `docs/field-tests/TEMPLATE-reactivation-metrics.md`
