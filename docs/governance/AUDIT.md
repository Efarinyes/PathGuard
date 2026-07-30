---
title: "Auditoria i Traçabilitat"
version: "1.0.0"
status: "active"
owner: "tech-lead"
---

# Auditoria i Traçabilitat

## Propòsit

Aquest document defineix com s'audita el projecte PathGuard i com es garanteix la traçabilitat entre especificacions, codi, proves i decisions. L'auditoria no és només una revisió final: és un procés continu que permet detectar desviacions abans que es converteixin en deute tècnic.

## Àmbit de l'auditoria

Es distingeixen tres tipus d'auditoria:

| Tipus | Objecte | Qui la fa | On es registra |
|---|---|---|---|
| **Tècnica** | Qualitat del codi, arquitectura, tests, seguretat | Tech Lead + agents especialitzats | `.pathguard/STATE.json > open_issues_from_audit`, informes a `docs/audits/` |
| **De producte** | Alineament amb els objectius de negoci, UX, riscos | Product owner o Tech Lead | ROADMAP, `docs/phases/phase-status.md` |
| **De procés** | Compliment de la metodologia Specification First, estat de specs, qualitat de la documentació | Tech Lead | `PERIODIC_REVIEW.md`, `STATE.json` |

## Registre d'issues

### Identificació

Cada issue d'auditoria rep un identificador segons el context:

- **R-P0-NEW-N**: Risc P0 nou detectat durant una auditoria.
- **AUDIT-YYYY-MM-DD-N**: Issue generic d'auditoria.
- **SPEC-NNN-BLOCK-N**: Bloqueig derivat d'una spec concreta.

### Format d'una issue

Una issue ha de contenir com a mínim:

- **ID** únic.
- **Títol** clar.
- **Severitat**: `critical`, `high`, `medium`, `low`.
- **Estat**: `open`, `investigating`, `mitigated`, `resolved`, `accepted`.
- **Descripció** del problema.
- **Causa arrel** (si es coneix).
- **Impacte**: quines capes, specs o releases afecta.
- **Accions**: qui fa què i fins quan.
- **Traçabilitat**: vincle a spec, commit, ADR o test.

### On es registren

Les issues actives i crítiques viuen a `.pathguard/STATE.json` sota `open_issues_from_audit`. Quan una issue es resol, es pot:

- Mantenir a `STATE.json` amb estat `resolved` i data de validació.
- Arxivar a `docs/audits/` si conté lliçons apreses.
- Referenciar des de la spec que la va resoldre.

## Traçabilitat

### Cadena de traçabilitat

Tot canvi significatiu ha de poder respondre aquestes preguntes:

1. **Per què es fa?** → Spec o ADR.
2. **Qui ho va decidir?** → Tech Lead / reviewer / QA.
3. **Qui ho va implementar?** → Agent owner.
4. **On està el codi?** → Branca, commits, PR.
5. **Com es va verificar?** → Tests, field tests, sign-off.

### Vincles obligatoris

| Canvi | Vincle obligatori |
|---|---|
| Nova funcionalitat | Spec `feature` o `integration` |
| Refactor | Spec `tech` |
| Decisió arquitectònica | ADR |
| Canvi de contracte (bridge, API) | Spec + ADR si escau |
| Fix de bug P0 | Issue + spec si no és trivial |
| Release | Tag + CHANGELOG + sign-off QA |

### Eines de traçabilitat

No es requereix cap eina específica d'OpenSpec. Els vincles són textuals i estructurals:

- El camp `adr` d'una spec apunta a `docs/decisions/NNNN-*.md`.
- El camp `addressed_issues` d'una spec llista les issues que resol.
- Els commits han de referenciar la spec al missatge o al PR.
- Els PRs han d'incloure `Closes SPEC-NNN` o `Related to SPEC-NNN`.

## Revisió de codi

### Nivells de revisió

| Nivell | Qui | Quan | Abast |
|---|---|---|---|
| Auto-revisió | Agent owner | Abans de PR | Estil, tests, build |
| Revisió de reviewer | Reviewer designat a la spec | Durant el PR | Compliment de la spec, qualitat |
| Sign-off de Tech Lead | Tech Lead | Abans de merge cross-capa | Contractes, ADRs, riscos |
| Sign-off de QA | QA | Abans de release | Criteris d'acceptació, field tests |

### Checklist de revisió

- [ ] El codi implementa els criteris d'acceptació de la spec.
- [ ] No hi ha regressions als tests baseline.
- [ ] Els nous tests cobreixen el happy path i almenys un error path.
- [ ] No s'han introduït `any`, `console.log` ni hacks.
- [ ] Els canvis a contractes estan reflectits a totes les capes afectades.
- [ ] La documentació (spec, ADR, guia) s'ha actualitzat si cal.

## Validació

### Validació tècnica

- Tests backend: 152/152 o més.
- Tests frontend: 108/108 o més.
- Build OK per a totes les capes implicades.
- Lint sense errors.

### Validació de camp

Si una spec afecta UX, GPS, WebSocket o comportament visible, cal validació de camp:

- Mínim 1 passeig de 15 minuts amb captura GPS correcta.
- Escenaris obligatoris segons el skill `pathguard-domain-field-testing`.
- Documentació dels resultats a `docs/field-tests/<data>-<escenari>.md`.

### Sign-off

QA és l'única autoritat per declarar una release com a "Beta Ready". Sense sign-off de QA, no es pot fer merge a `main` per a una release.

## Arxivament d'auditories

Les auditories històriques es mouen a `docs/archive/` amb una capçalera del tipus:

```markdown
<!-- ARXIVAT: substituït per <referència> -->
```

L'índex `docs/INDEX.md` manté l'enllaç però marcat com a històric.

## Referències

- `ARCHITECT.md` — Arquitectura de governança.
- `EXECUTION.md` — Execució de specs.
- `PERIODIC_REVIEW.md` — Revisions periòdiques.
- `pathguard-domain-field-testing` — Procediment de proves de camp.
- `pathguard-domain-test-pyramid` — Piràmide de tests.
