<!-- ARXIVAT: SUPERSEDED per SPEC-188 -->
---
id: tech-SPEC-186
title: Android deferred location buffer on rest and process death
type: tech
status: superseded
priority: P0
created: 2026-08-02
author: tech-lead
agents_affected:
  - android
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: null
superseded_by: SPEC-188
---

# Spec: Android deferred location buffer on rest and process death

> **SUPERSEDED (2026-08-03) per [SPEC-188](tech-SPEC-188-recovered-only-from-buffer.md).**  
> Walk 154 va demostrar que “no foreground → recovered” és incorrecte.  
> `is_recovered=true` NOMÉS després de buffer de recuperació real (flush fallit o reload des de disc).

## 1. Objectiu

~~Quan el pipeline de transmissió en viu no és fiable (UI en segon pla / repòs / kill), els punts s’han de **persistir al dispositiu** i enviar-se després amb `is_recovered=true`…~~  
Veure SPEC-188.

## 2. Semàntica de producte (OBSOLETA — 2026-08-02)

Substituïda per PD-RECOVERED-ONLY-FROM-BUFFER / SPEC-188.

## 3. Criteris d’acceptació (històric)

- [x] `LocationBuffer.persist()` desa la cua a disc. *(reutilitzable)*
- [x] ~~Punts acceptats amb app no foreground → `isRecovered=true` + persist.~~ **REVOCAT**
- [x] ~~`MARK_BACKGROUNDED` … marcats recovered.~~ **REVOCAT**
- [x] Reload des de disc → tots `isRecovered=true` (ja existia) + flush. *(vàlid si reload = recuperació)*
- [x] Tests JUnit per persist + deferred add. *(reescriure sota 188)*
- [ ] Field: kill amb punts pendents → taronja a BD/mapa. *(passa a SPEC-188 AC-4/AC-6)*

## 4. Out of scope

- iOS, caregiver force (184), bridge TS.
