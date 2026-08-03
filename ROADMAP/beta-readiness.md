# PathGuard — Beta readiness

**Última actualització:** 2026-08-03  
**Target:** `v2.7.0-beta.1` (beta externa testable)  
**Estat del dia a dia:** `.pathguard/STATE.json` · història: [`docs/EVOLUTION.md`](../docs/EVOLUTION.md)

## Objectiu

Una beta que un familiar real pugui usar amb tranquil·litat:

- Pacient Android: passeig amb pantalla apagada / butxaca, GPS fiable
- Cuidador (PWA): mapa i presència honestos
- Backend estable (Render + Supabase)
- Procediment de camp clar (sense rituals falsos)

**iOS natiu:** diferit (SPEC-182) — no bloqueja una beta Android-first.

## Gates oberts (ara)

| Gate | Spec / lloc | Estat |
|---|---|---|
| `is_recovered` només des del buffer real | SPEC-188 | Mergejat — **field AC-6 pendent** |
| Notif FGS visible (lock screen) | SPEC-187 | Smoke OK — tancar amb camp |
| Presència HTTP honesta | SPEC-185 | Field pendent |
| Keepalive FGS (si cal post-188) | SPEC-183 | Revisió després del camp |
| Buffer / recovered umbrella | SPEC-180 | Alineat amb 188 |
| iOS buffer | SPEC-182 | **Diferit** |

Catàleg viu: [`specs/000-index.md`](../specs/000-index.md).

## Checklist Beta Ready (honesta)

### Ja en bona forma
- [x] PWA: registre, activació, monitoratge, SOS (baseline producte)
- [x] Backend / frontend tests baseline (152 / 108 — excepcions preexistents documentades)
- [x] Una font GPS natiu (ADR-0004) + bridge LocationSync
- [x] Docs d’entrada: `AGENTS.md`, `CONTEXT.md`, `docs/EVOLUTION.md`, skills Cursor
- [x] Specs magres + `specs/archive/`
- [x] ADRs 0001–0006 acceptats

### Pendents de camp / producte
- [ ] Field post–SPEC-188: majoria `is_recovered=false` amb pantalla apagada + notif ON; taronja només recuperació real
- [ ] Presència cuidador coherent (WS + HTTP + aging) en el mateix passeig
- [ ] APK de col·laboradors amb plugin actual (`f896660`+)
- [ ] Sign-off QA “Beta Ready” (única autoritat)

### Explicitament fora del gate beta Android-first
- [ ] iOS IPA + field (SPEC-182)
- [ ] Revocació `device_token` (SPEC-030 — backlog)
- [ ] CI/CD complet (SPEC-060/080 — backlog)
- [ ] i18n / tests natius / Redis presence (post-beta — veure `post-beta.md`)

## Riscos residuals

| Risc | Mitigació |
|---|---|
| OEM Android mata el FGS | Notif visible + keepalive; field real, no només unit tests |
| Semàntica mapa (ambre) confon | Regla PD-RECOVERED-ONLY-FROM-BUFFER + camp 188 |
| Cold start Render | Acceptat / ping si cal; no bloqueja beta petita |
| Sense iPhone | Beta Android-first; iOS quan hi hagi dispositiu |

## Sign-off

| Rol | Què signa |
|---|---|
| **QA** | “Beta Ready” |
| Tech Lead | Cross-capa / ADRs |
| Owner | Acceptació per usuaris externs |

## Versions (resum)

| Versió | Nota |
|---|---|
| v2.6.x | PWA + Postgres + primer natiu |
| **v2.7.0-beta.1** | Target — Android camp + PWA cuidador |
| Després | `post-beta.md` |

Detall narratiu: `docs/EVOLUTION.md`. Canvis versionats (parcial): `CHANGELOG.md`.

## Referències

- [`post-beta.md`](post-beta.md) — després de la beta
- [`../docs/phases/phase-status.md`](../docs/phases/phase-status.md)
- [`../docs/architecture/overview.md`](../docs/architecture/overview.md)
- Skill camp: `.cursor/skills/pathguard-domain-field-testing/SKILL.md`
