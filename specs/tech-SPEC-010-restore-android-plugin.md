---
id: tech-SPEC-010
title: Restore Android plugin (3 fitxers perduts)
type: tech
status: draft
priority: P0
created: 2026-06-30
author: tech-lead
agents_affected:
  - android
  - platform-integration
reviewer: platform-integration
blocked_by: []
replaces: null
supersedes: null
adr: null
---

# Spec: Restore Android plugin (3 fitxers perduts)

## 1. Objectiu
Restaurar els 3 fitxers Java del plugin Android eliminats a la branca `feat/ios-native-layer` perquè el plugin pugui compilar i la capa Android torni a ser funcional.

## 2. Context
Durant el treball de la capa iOS, la branca `feat/ios-native-layer` té el plugin Android trencat:
- `BufferStore.java` — esborrat
- `LocationHttpClient.java` — esborrat
- `LocationSyncForegroundService.java` — esborrat

El fitxer `LocationSyncPlugin.java` encara referencia `LocationSyncForegroundService.class`, per la qual cosa la branca **no pot compilar Android**. Audit confirmat a `audit_native_layer.md` (R-P0-1, severitat CRÍTICA).

## 3. Problema
- Cap build APK funciona des de la branca actual
- Si es fa deploy de beta amb Android, l'app no arrencarà
- Regressió directa sobre l'última versió vàlida (`main`)

## 4. Impacte arquitectònic
- **Android:** ha de recuperar 3 fitxers
- **Platform Integration:** ha de validar que el contracte TS segueix sent vàlid
- **No canvis** al contracte TS del bridge
- **No canvis** al frontend

## 5. Criteris d'acceptació
- [ ] AC-1: `BufferStore.java` restaurat, compila
- [ ] AC-2: `LocationHttpClient.java` restaurat, compila
- [ ] AC-3: `LocationSyncForegroundService.java` restaurat, compila
- [ ] AC-4: `LocationSyncPlugin.java` ja no penja d'una classe inexistent
- [ ] AC-5: `./gradlew assembleDebug` finalitza sense errors
- [ ] AC-6: APK debug es pot instal·lar al Redmi
- [ ] AC-7: Walk test al Redmi funciona com a `main` (15 min, punts al mapa)

## 6. Riscos identificats
- **R1:** Els fitxers a `main` poden ser incompatibles amb els canvis iOS de `feat/ios-native-layer`
  - **Mitigació:** aplicar canvis només a fitxers Android; revisar imports
- **R2:** El reaparellament pot trencar el plugin iOS
  - **Mitigació:** tests Gradle + tests Xcode al final; cap canvi a fitxers iOS
- **R3:** Conflicte de merge amb `develop`
  - **Mitigació:** PR separat, revisat per Platform Integration

## 7. Pla d'implementació

**Branca:** `fix/SPEC-010-restore-android-plugin` (des de `main`)

1. **Tech Lead** obre la branca des de `main` (no des de `develop`, perquè `develop` pot tenir canvis trencats)
2. **Agent Android:**
   - Identifica els 3 fitxers a `git log -- frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/{BufferStore,LocationHttpClient,LocationSyncForegroundService}.java`
   - Recupera l'última versió vàlida amb `git checkout <commit> -- <file>`
   - Comprova imports
3. **Agent Android:** `./gradlew assembleDebug` ha d'acabar sense errors
4. **Agent QA:** smoke test al Redmi (15 min walk)
5. **PR** a `develop` amb revisió de Platform Integration
6. **Merge** quan validat

## 8. Pla de validació

- **Tests Gradle:** `./gradlew assembleDebug` exit
- **Tests JUnit:** (cap actualment — deute tècnic)
- **Field test al Redmi:** 15 min walk, verificar punts al mapa
- **Comparació amb `main`:** comportament equivalent a l'última versió vàlida

## 9. Out of scope
- Refactor SRP del plugin (a SPEC-120 o post-beta)
- Tests unitaris JUnit (a SPEC-110)
- Modificar funcionalitat existent

## 10. Referències
- `audit_native_layer.md` secció 1 (R-P0-1)
- `.opencode/skills/pathguard-agent-android/SKILL.md`
- `.opencode/skills/pathguard-domain-android-plugin/SKILL.md`
- Última versió vàlida: `main` branch

---

**Notes:**
- Aquesta spec NO toca iOS. Si després calen canvis iOS, seran specs separades (SPEC-020.x).
- La branca origen ha de ser `main` perquè `develop` pot contenir canvis incompatibles.
- Si `main` no té els 3 fitxers, caldrà recórrer `git log` més enllà.
