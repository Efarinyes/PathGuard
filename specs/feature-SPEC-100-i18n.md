---
id: feature-SPEC-100
title: i18n: infraestructura per a CA/ES/EN
type: feature
status: draft
priority: P2
created: 2026-06-30
author: tech-lead
agents_affected:
  - frontend
  - tech-lead
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: pending
---

# Spec: i18n: infraestructura per a CA/ES/EN

## 1. Objectiu
Establir infraestructura d'internacionalització per permetre traduccions CA/ES/EN. Actualment 165 strings hardcoded en català.

## 2. Context
Decisió arxivada: i18n post-beta (veure `docs/archive/action-plan.md` secció 4.5). Quan es decideixi fer, cal infraestructura adequada.

## 3. Problema
- 165 strings hardcoded
- Impossibilitat d'obrir a mercats ES/EN
- Cost de migració creix amb cada feature

## 4. Impacte
- **Frontend:** triar llibreria (next-intl, react-i18next, etc.), migrar 165 strings
- **Tech Lead:** ADR sobre l'estratègia

## 5. Criteris d'acceptació
- [ ] AC-1: Llibreria d'i18n triada i documentada (ADR)
- [ ] AC-2: 165 strings migrades
- [ ] AC-3: Detecció per cookie/manual override
- [ ] AC-4: Tests de cada idioma
- [ ] AC-5: Build prod genera bundles per idioma

## 6. Riscos
- **R1:** Llibreria triada no suporta Next.js 16
- **R2:** SSR rendering complicat
- **R3:** Tests e2e multi-idioma complexos

## 7. Pla
**Branca:** `feat/SPEC-100-i18n`

1. Tech Lead: ADR (next-intl vs alternatives)
2. Frontend: setup
3. Migrar strings
4. Tests

## 8. Validació
- 3 idiomes funcionen
- Cookie/override funciona
- Build OK

## 9. Out of scope
- Traduccions automàtiques (DeepL/Google)
- RTL (no objectiu)

## 10. Referències
- `docs/archive/action-plan.md` secció 4.5
- Next.js docs i18n
