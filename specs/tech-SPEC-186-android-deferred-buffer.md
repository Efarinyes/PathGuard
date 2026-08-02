---
id: tech-SPEC-186
title: Android deferred location buffer on rest and process death
type: tech
status: implementing
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
---

# Spec: Android deferred location buffer on rest and process death

## 1. Objectiu

Quan el pipeline de transmissió en viu no és fiable (UI en segon pla / repòs / kill), els punts s’han de **persistir al dispositiu** i enviar-se després amb `is_recovered=true`, perquè el cuidador vegi trams diferits (taronja) útils per analítica. **Sense mode avió.** iOS fora d’abast (SPEC-182 més endavant).

## 2. Semàntica de producte (2026-08-02)

- `false` = enviat en transmissió en viu mentre el pipeline és actiu.
- `true` = acumulat mentre el dispositiu/serveis estaven adormits o el flush va fallar, i enviat quan el pipeline torna online.
- Keep-alive (SPEC-183) redueix adormides → menys taronja; el buffer és la xarxa de seguretat.

## 3. Criteris d’acceptació

- [x] `LocationBuffer.persist()` desa la cua a disc.
- [x] Punts acceptats amb app no foreground → `isRecovered=true` + persist.
- [x] `MARK_BACKGROUNDED` / `onTaskRemoved` / `onDestroy` persisteixen pendents marcats recovered.
- [x] Reload des de disc → tots `isRecovered=true` (ja existia) + flush.
- [x] Tests JUnit per persist + deferred add.
- [ ] Field: kill amb punts pendents → taronja a BD/mapa.

## 4. Out of scope

- iOS, mode avió, caregiver force (184), bridge TS.
