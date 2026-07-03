---
id: tech-SPEC-110
title: Tests unitaris natius (XCTest + JUnit)
type: tech
status: draft
priority: P2
created: 2026-06-30
author: tech-lead
agents_affected:
  - ios
  - android
  - qa
reviewer: qa
blocked_by:
  - SPEC-010
replaces: null
supersedes: null
adr: null
---

# Spec: Tests unitaris natius (XCTest + JUnit)

## 1. Objectiu
Establir suites de tests unitaris natius per a iOS (XCTest) i Android (JUnit) cobrint els components crítics del plugin LocationSync.

## 2. Context
Audit `audit_native_layer.md` (issue 14) identifica zero tests unitaris natius. Regressions difícil de detectar. Cost alt de validació manual.

## 3. Problema
- Regressions no detectades
- Validació depèn de field tests
- Cobertura zero als plugins natius

## 4. Impacte
- **iOS:** XCTest per `LocationAcquirer`, `LocationBuffer`, `LocationHttpClient`
- **Android:** JUnit per `LocationAcquirer`, `LocationBuffer`, `BufferStore`
- **QA:** validar cobertura

## 5. Criteris d'acceptació

### iOS
- [ ] AC-1: `LocationBufferTests.swift` — tests per `onFlushResult` (success/fail), `recoveryStreak`
- [ ] AC-2: `LocationAcquirerGateTests.swift` — tests per cada gate GPS
- [ ] AC-3: `LocationHttpClientTests.swift` — tests amb `URLProtocol` mock
- [ ] AC-4: Cobertura > 70% del plugin

### Android
- [ ] AC-5: `LocationAcquirerTest.java` — tests per cada gate
- [ ] AC-6: `LocationBufferTest.java` — tests per `onFlushResult`
- [ ] AC-7: `BufferStoreTest.java` — tests per save/load
- [ ] AC-8: Cobertura > 70% del plugin

## 6. Riscos
- **R1:** Tests massa acoblats a la implementació
- **R2:** Mock de CLLocationManager complex
- **R3:** Setup JUnit per Android complex

## 7. Pla
**Branca:** `test/SPEC-110-native-unit-tests`

1. iOS: XCTest setup
2. Android: JUnit setup
3. Tests per gates (més crítics)
4. Tests per buffer
5. Tests per HTTP/storage
6. CI integration

## 8. Validació
- Tests corren en CI
- Cobertura > 70%
- Sign-off QA

## 9. Out of scope
- UI tests natius (post-beta)
- Integration tests cross-platform (post-beta)

## 10. Referències
- `audit_native_layer.md` secció 14
- `.opencode/skills/pathguard-domain-android-plugin/SKILL.md`
- `.opencode/skills/pathguard-domain-ios-plugin/SKILL.md`
