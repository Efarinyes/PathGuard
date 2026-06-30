---
id: tech-SPEC-070
title: iOS Info.plist: armv7 → arm64
type: tech
status: draft
priority: P1
created: 2026-06-30
author: tech-lead
agents_affected:
  - ios
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: null
---

# Spec: iOS Info.plist: armv7 → arm64

## 1. Objectiu
Corregir `UIRequiredDeviceCapabilities` a `Info.plist` canviant `armv7` per `arm64` (o eliminant la clau) per evitar advertències o rebuig a l'App Store.

## 2. Context
Audit `audit_native_layer.md` (issue 13) identifica que `Info.plist` té `armv7` però l'iPhone 8 (test device) és `arm64`. Pot generar advertències d'App Store.

## 3. Problema
- `armv7` no s'aplica a dispositius moderns
- L'App Store pot mostrar advertència o rebuig
- Inconsistència amb la realitat dels dispositius

## 4. Impacte
- **iOS:** modifica `frontend/ios/App/App/Info.plist`
- Cap impacte cross-capa

## 5. Criteris d'acceptació
- [ ] AC-1: `Info.plist` té `arm64` o no té `UIRequiredDeviceCapabilities`
- [ ] AC-2: Build iOS exit
- [ ] AC-3: Validació App Store Connect sense advertències
- [ ] AC-4: Test al dispositiu funciona

## 6. Riscos
- **R1:** Si s'elimina la clau, s'amplia el rang de dispositius suportats (pot ser bo)
- **R2:** Apple potser demana justificació — documentar

## 7. Pla
**Branca:** `fix/SPEC-070-ios-armv7`

1. iOS: modifica `Info.plist`
2. Build local
3. Test al iPhone 8
4. PR

## 8. Validació
- Build exit
- App Store Connect validation (sense advertència)

## 9. Out of scope
- Suport per iPad (no objectiu)
- Altres keys de `Info.plist`

## 10. Referències
- `audit_native_layer.md` secció 13
- `.pathguard/skills/_domain/pathguard-ios-plugin.md`
