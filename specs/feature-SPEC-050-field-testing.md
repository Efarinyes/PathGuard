---
id: feature-SPEC-050
title: Proves de camp amb dispositius reals
type: feature
status: draft
priority: P0
created: 2026-06-30
author: tech-lead
agents_affected:
  - qa
  - ios
  - android
  - frontend
reviewer: tech-lead
blocked_by:
  - SPEC-010
  - SPEC-020
replaces: docs/archive/guia-proves-reals.md
supersedes: null
adr: null
---

# Spec: Proves de camp amb dispositius reals

## 1. Objectiu
Executar i documentar els **7 escenaris de proves de camp** amb dispositius reals per validar que la beta és llesta per a usuaris reals.

## 2. Context
El skill `.pathguard/skills/_domain/pathguard-field-testing.md` ja defineix els 7 escenaris. Aquesta spec els **executa** i en documenta els resultats.

## 3. Problema
- No s'ha fet cap validació de camp amb iOS (Android parcial)
- La guia original a `docs/archive/guia-proves-reals.md` no s'ha executat recentment
- Cal sign-off de QA per release

## 4. Impacte arquitectònic
- **QA:** redacta reports, valida resultats
- **iOS:** dispositiu iPhone 8 + iPhone recent
- **Android:** dispositiu Redmi
- **Frontend:** web testing al navegador
- **Tech Lead:** sign-off final

## 5. Criteris d'acceptació

### 7 Escenaris (tots han de passar amb ✅)

| # | Escenari | Dispositiu | Durada | Criteri |
|---|---|---|---|---|
| 1 | Walk normal | Pacient | 15 min | Tots els punts al mapa |
| 2 | Pèrdua cobertura | Pacient | 5+5 min | `is_recovered` correcte |
| 3 | Screen-off | Pacient | 30 min | Punts seguits |
| 4 | Kill app | Pacient | 15 min | `walkId` recuperat |
| 5 | SOS | Tots dos | 5 min | So + modal < 2s |
| 6 | Multi-caregiver | 2 cuidadors | 10 min | Broadcast a tots |
| 7 | Bateria | Pacient | 1h | Consum raonable |

### Reporting
- [ ] AC-1: 7 reports a `docs/field-tests/<data>-<escenari>.md`
- [ ] AC-2: Cada report té dispositiu, durada, resultat, issues
- [ ] AC-3: Issues identificats traslladats a specs si calen
- [ ] AC-4: Sign-off de QA

## 6. Riscos
- **R1:** Dispositiu no disponible — cal tenir 2-3 dispositius
- **R2:** Cobertura dolenta al lloc de test — escollir zona urbana
- **R3:** Issues trobats bloquegen beta — cal prioritzar ràpid

## 7. Pla
**Branca:** `qa/SPEC-050-field-testing` (pot ser branca de reports)

1. QA: planifica dispositius i dates
2. Per cada escenari: executar, documentar
3. Issues → specs noves
4. Sign-off

## 8. Validació
- Reports signats per QA
- Sign-off de Tech Lead
- Sign-off de release per QA

## 9. Out of scope
- Automatització de field tests (no és viable)
- Field tests en producció (sempre staging o local)

## 10. Referències
- `.pathguard/skills/_domain/pathguard-field-testing.md` (procediment)
- `docs/guides/real-world-testing.md` (guia)
- `docs/archive/guia-proves-reals.md` (guia original)
