# ADR-0003: Capacitor Swift Package Manager (no CocoaPods)

## Status

`accepted` — 2026-Q2

## Context

iOS Capacitor té dues maneres de gestionar dependencies:

1. **CocoaPods** (`Podfile`)
   - ✅ Estàndard de la indústria iOS
   - ✅ Molta documentació
   - ❌ Setup complex
   - ❌ Ruby dependency
   - ❌ Resolució lenta
2. **Swift Package Manager** (`Package.swift`)
   - ✅ Natiu Apple
   - ✅ Zero Ruby
   - ✅ Ràpid
   - ⚠️ Menys estable a Capacitor (versió 8+)

## Decision

Adoptem **Swift Package Manager (SPM)** per a la capa iOS.

Configuració:
- `frontend/plugins/location-sync/Package.swift` — SPM package
- `frontend/ios/App/CapApp-SPM/Package.swift` — Capacitor SPM
- `xcodebuild` directe (no `pod install`)

## Alternatives considerades

### A. **CocoaPods** (default Capacitor)
- ✅ Estàndard
- ❌ Setup verbose
- ❌ Ruby overhead
- ❌ CocoaPods slow resolve

### B. **Swift Package Manager (escollida)**
- ✅ Natiu Apple
- ✅ Ràpid
- ✅ Zero Ruby
- ⚠️ Capacitor 8+ estable
- ✅ Millor integració amb Xcode 15+

## Consequences

### Positives
- Build més ràpid
- Menys dependencies externes
- Natiu Apple

### Negatives
- Capacitor SPM madur des de v8
- Si fallen SPM, menys comunitat que CocoaPods

### Mitigacions
- Test build a cada canvi
- Documentació clara a `pathguard-domain-ios-plugin.md`

## Implementation

- `frontend/plugins/location-sync/Package.swift` definit
- `npx cap sync ios` regenera
- Build: `xcodebuild -workspace App/App.xcworkspace -scheme App -configuration Debug`

## References

- `.opencode/skills/pathguard-domain-ios-plugin/SKILL.md`
- `.opencode/skills/pathguard-domain-capacitor-config/SKILL.md`
- [Capacitor SPM docs](https://capacitorjs.com/docs/ios/spm)
