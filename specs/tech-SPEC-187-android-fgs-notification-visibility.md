---
id: tech-SPEC-187
title: Android FGS notification visible on lock screen
type: tech
status: implementing
priority: P0
created: 2026-08-02
author: tech-lead
agents_affected:
  - android
reviewer: tech-lead
blocked_by: []
---

# Spec: Android FGS notification visible on lock screen

## 1. Objectiu

La notificació de passeig actiu ha de ser **visible de forma discreta** amb pantalla bloquejada (prova de vida del FGS), sense so ni vibració. Canal nou (Android no actualitza importance d’un canal existent).

## 2. Criteris d’acceptació

- [x] Canal `pathguard_walk_v2` amb `IMPORTANCE_LOW` + `VISIBILITY_PRIVATE`.
- [x] Títol «Bon passeig»; silent; no badge.
- [x] `startForeground` amb tipus `location` a API 34+.
- [ ] Field Redmi: visible amb pantalla bloquejada durant walk.
