# PathGuard — Milestones

Llista cronològica de milestones assolits i pendents.

## Milestones assolits

| Versió | Data | Descripció |
|---|---|---|
| v1.0.0 | 2025-XX-XX | Release inicial (PWA pura) |
| v2.0.0-beta.1 | 2026-05-08 | PWA estable post-Phase B (deute tècnic eliminat) |
| v2.6.0-beta.1 | 2026-05-31 | Post-Phase G (PostgreSQL via Supabase) |
| v2.6.0-pwa-stable.0 | 2026-XX-XX | Snapshot pre-Capacitor |

## Milestones pendents

| Versió | Target | Descripció | Depèn de |
|---|---|---|---|
| **v2.7.0-beta.1** | Q3 2026 | Beta amb capes natives (Android + iOS) | SPEC-010, 020, 030, 040, 050, 060 |
| v2.8.0-beta.2 | Q4 2026 | Beta 2 — feedback d'usuaris reals | v2.7.0-beta.1 |
| v2.9.0-rc.1 | Q1 2027 | Release candidate | v2.8.0-beta.2 |
| **v3.0.0** | Q2 2027 | Release estable | v2.9.0-rc.1 |

## Roadmap visual

```
v1.0.0 ─► v2.0.0-beta.1 ─► v2.6.0-beta.1 ─► v2.6.0-pwa-stable.0
                                                  │
                                                  ▼
                                          v2.7.0-beta.1 (target)
                                                  │
                                                  ▼
                                          v2.8.0-beta.2
                                                  │
                                                  ▼
                                          v2.9.0-rc.1
                                                  │
                                                  ▼
                                              v3.0.0 (stable)
```

## Característiques per versió

### v2.7.0-beta.1 (Target Beta)
- ✅ PWA funcional
- ✅ Capa Android funcional (post-SPEC-010)
- ✅ Capa iOS funcional (post-SPEC-020)
- ✅ Revocació de device_token (SPEC-030)
- ✅ 1 font GPS, 0 pèrdua
- ✅ Permisos centralitzats
- ✅ Bridge contract canònic
- ✅ Field tests validats

### v2.8.0-beta.2
- Feedback d'usuaris reals aplicat
- i18n (CA/ES/EN) (SPEC-100)
- Tests unitaris natius (SPEC-110)

### v2.9.0-rc.1
- Bugfixes de beta
- Performance optimitzacions
- Polish UX

### v3.0.0
- App Store / Play Store submission
- Documentació pública
- Llicència
- Màrqueting

## Decissions de versionat

- **MAJOR** — canvis incompatibles (e.g., v2 → v3 per breaking API)
- **MINOR** — nova funcionalitat (e.g., v2.6 → v2.7 per beta)
- **PATCH** — correccions (e.g., v2.7.0 → v2.7.1)
- **PRERELEASE** — `beta.N` o `rc.N`

## Referències

- [`beta-readiness.md`](beta-readiness.md) — Cronograma beta
- [`../docs/phases/phase-status.md`](../docs/phases/phase-status.md) — Estat per fase
- [`../CHANGELOG.md`](../CHANGELOG.md) — Canvis detallats
