# ADR-0002: Capacitor over React Native

## Status

`accepted` — 2026-Q2 (inici del projecte)

## Context

Necessitem una app per a pacient que funcioni en:
- Android (natiu per GPS, foreground service)
- iOS (natiu per background location, permisos)
- I que comparteixi la major part del codi amb el cuidador (PWA web)

Opcions:

1. **PWA pura** (web)
   - ✅ Una sola codebase
   - ❌ Background location limitat en iOS
   - ❌ No foreground service a Android
2. **React Native** (natiu pur)
   - ✅ Natiu complet
   - ❌ No comparteix amb PWA
   - ❌ Dues codebases
3. **Capacitor** (PWA + capa nativa)
   - ✅ PWA + capa nativa
   - ✅ Una sola codebase
   - ✅ Bridge TypeScript
4. **Flutter**
   - ✅ Natiu performant
   - ❌ No comparteix amb PWA web

## Decision

Adoptem **Capacitor** com a wrapper nadiu sobre la nostra PWA Next.js.

Arquitectura:
- **Web:** Next.js PWA (cuidador + pacient si volen)
- **Natiu:** Capacitor + plugin LocationSync custom (Android Java + iOS Swift)
- **Bridge:** TypeScript tipat via `@capacitor/core`

## Alternatives considerades

### A. PWA pura (escollida en v1)
- ✅ Senzillesa
- ❌ Limitacions de background location a iOS
- ❌ No foreground service Android
- **Veredicte:** insuffient per a ús en camp

### B. React Native
- ✅ Natiu complet
- ❌ Dues codebases
- ❌ Cost de mantenir Web + RN
- **Veredicte:** overkill

### C. **Capacitor (escollida)**
- ✅ PWA + nadiu
- ✅ Una sola codebase
- ✅ Bridge TypeScript tipat
- ✅ Custom plugins Java/Swift per GPS natiu
- **Veredicte:** millor balanceig

### D. Flutter
- ✅ Natiu performant
- ❌ No comparteix amb PWA
- ❌ Llenguatgepropi (Dart)
- **Veredicte:** massa cost

## Consequences

### Positives
- 95% del codi compartit (frontend)
- Bridge TypeScript tipat
- Custom plugins per necessitats específiques (LocationSync)
- PWA funciona standalone per a cuidador
- Build APK/IPA quan cal

### Negatives
- Plugin custom ha de mantenir-se (Java + Swift paral·lel)
- Bridge overhead (negligible per LocationSync)
- Documentació Capacitor menys extensa que RN

### Mitigacions
- Skill `pathguard-bridge-contract.md` com a font única
- Tests cross-platform al skill `pathguard-test-pyramid`
- Field tests validatius

## Implementation

- `frontend/capacitor.config.ts` — config principal
- `frontend/plugins/location-sync/` — plugin custom
- `frontend/android/` + `frontend/ios/` — projects nadius

## References

- `.pathguard/skills/_domain/pathguard-capacitor-config.md`
- [Capacitor docs](https://capacitorjs.com/docs)
