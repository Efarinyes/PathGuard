---
id: tech-SPEC-040
title: Bridge LocationSync v2 — 6 mètodes, contracte canònic
type: tech
status: draft
priority: P0
created: 2026-06-30
author: tech-lead
agents_affected:
  - platform-integration
  - ios
  - android
  - frontend
reviewer: tech-lead
blocked_by:
  - SPEC-010
  - SPEC-020
replaces: null
supersedes: null
adr: pending
---

# Spec: Bridge LocationSync v2 — 6 mètodes, contracte canònic

## 1. Objectiu
Consolidar el contracte TypeScript del bridge `LocationSync` com a **API canònica** entre les 3 capes (TS, iOS, Android), amb 6 mètodes validats, tests, i zero divergència.

## 2. Context
El contracte actual a `frontend/plugins/location-sync/src/index.ts` ja té 6 mètodes, però:
- No hi ha tests que validin la signatura
- iOS implementa tots 6 però `markBackgrounded/Forwarded` són buits
- Android implementa tots 6 via intents al service
- Frontend en crida 4-5 però no tots de forma consistent
- El skill `pathguard-domain-bridge-contract.md` és bo però no és enforcing

## 3. Problema
- Sense contracte explícit, els agents natius tendeixen a divergir
- Sense tests, regressions no es detecten
- Frontend crida mètodes que no toca, generant soroll al bridge

## 4. Impacte arquitectònic
- **Platform Integration:** redacta contracte canònic, tests TS
- **iOS:** valida que implementa tots 6, omple `markBackgrounded/Forwarded`
- **Android:** valida que implementa tots 6
- **Frontend:** valida que crida els correctes (no `markBackgrounded` sense tracking)

## 5. Criteris d'acceptació
- [ ] AC-1: `LocationSync` té exactament 6 mètodes (signatura TS canònica)
- [ ] AC-2: Skill `pathguard-domain-bridge-contract.md` actualitzat amb la v2
- [ ] AC-3: Tests Vitest per la interfície TS (signatura + tipus)
- [ ] AC-4: iOS implementa els 6 (incloent `markBackgrounded/Forwarded` no buits)
- [ ] AC-5: Android implementa els 6
- [ ] AC-6: Frontend crida només els necessaris (no `markBackgrounded` sense tracking)
- [ ] AC-7: Cap divergència entre iOS, Android, TS

## 6. Riscos
- **R1:** iOS/AAndroid divergeixen perquè no hi ha contracte — mitigat amb skill
- **R2:** Tests TS no validats — calen tests
- **R3:** Frontend crida massa mètodes — cal revisar

## 7. Pla
**Branca:** `refactor/SPEC-040-bridge-contract-v2`

1. Platform: actualitza contracte v2
2. iOS: implementa `markBackgrounded/Forwarded` + valida resta
3. Android: valida tots 6
4. Frontend: neteja crides innecessàries
5. Tests: TS + e2e cross-platform
6. PR

## 8. Validació
- Tests Vitest per TS
- Tests e2e (web i nadiu)
- Validació manual cross-platform

## 9. Out of scope
- Nous mètodes al bridge
- Breaking changes a la signatura (v3 si cal, no en aquesta spec)

## 10. Referències
- `audit_native_layer.md` (multi-referència)
- `.opencode/skills/pathguard-domain-bridge-contract/SKILL.md`
- SPEC-020, SPEC-030
