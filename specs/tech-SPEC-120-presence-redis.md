---
id: tech-SPEC-120
title: WebSocket presence via Redis (post-beta)
type: tech
status: draft
priority: P2
created: 2026-06-30
author: tech-lead
agents_affected:
  - backend
  - devops
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: pending
---

# Spec: WebSocket presence via Redis (post-beta)

## 1. Objectiu
Migrar la presència WebSocket i els `group_rooms` d'in-memory a **Redis Pub/Sub** per permetre escalat horitzontal a múltiples workers.

## 2. Context
Audit `audit_native_layer.md` (issue 5) i `technical_audit.md` (AR-2): `ConnectionManager` manté connexions, presència, `last_http_location_at` en memòria dins un sol procés. Si el backend escala a múltiples workers, cada instància tindrà el seu propi estat i els broadcasts no arribaran a tots.

## 3. Problema
- Escalat horitzontal limitat
- Resiliència baixa (un worker mor → perd connexions)
- Pub/Sub local no escala

## 4. Impacte
- **Backend:** migrar `ConnectionManager` a Redis
- **DevOps:** configurar Redis a Render
- **Post-beta:** perquè actualment 1 worker és suficient

## 5. Criteris d'acceptació
- [ ] AC-1: Redis configurat a Render
- [ ] AC-2: `ConnectionManager` usa Redis Pub/Sub
- [ ] AC-3: Tests d'integration amb múltiples workers
- [ ] AC-4: Load tests amb connexions concurrents
- [ ] AC-5: Documentació a ADR

## 6. Riscos
- **R1:** Latència de Redis pot afectar real-time
- **R2:** Cost de Redis addicional
- **R3:** Complexitat operacional augmenta

## 7. Pla
**Branca:** `refactor/SPEC-120-presence-redis`

1. DevOps: configurar Redis
2. Backend: abstracció `EventBus` (in-memory / Redis)
3. Migrar ConnectionManager
4. Tests
5. Load tests
6. PR

## 8. Validació
- Tests integration multi-worker
- Load tests
- Sign-off

## 9. Out of scope
- Redis Cluster (post-MVP)
- Redis Sentinel HA (post-MVP)

## 10. Referències
- `audit_native_layer.md` secció 5
- `.audit_archive/technical_audit.md` (AR-2)
