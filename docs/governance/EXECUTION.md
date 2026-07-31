---
title: "Execució de Specifications"
version: "1.0.0"
status: "active"
owner: "tech-lead"
---

# Execució de Specifications

## Propòsit

Aquest document defineix com es passa d'una especificació aprovada a codi validat i integrat. Alinea la metodologia **Specification First** amb el flux real de treball del projecte: branques, commits, tests, pull requests i validació.

Aquest document no substitueix els skills de workflow SDD, sinó que resumeix el cicle d'execució des de la perspectiva de la governança.

## Precondicions per executar una spec

Abans de començar la implementació, s'han de complir:

- [ ] La spec està en estat `approved`.
- [ ] L'agent actiu coincideix amb l'`agent_owner` de la spec (o el Tech Lead l'ha assignat).
- [ ] La branca d'implementació està definida a la spec.
- [ ] Els tests baseline són verds:
  - Backend: 152/152.
  - Frontend: 108/108.
- [ ] La build és correcta.
- [ ] No hi ha bloquejos actius que impedeixin la implementació.

## Fases d'execució

### 1. Setup

1. **Carregar skills**: `pathguard-core-state`, skill del rol, skills de domini i `pathguard-workflow-sdd-implement`.
2. **Llegir la spec** completa.
3. **Obrir branca** des de `develop` (o `main` només per hotfix):
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b <type>/SPEC-NNN-kebab-case
   ```
4. **Actualitzar `STATE.json`**: posar la spec a `implementing` i registrar la branca.

### 2. Implementació per capes

Seguir l'ordre definit al pla d'implementació de la spec:

1. **Contractes primer**: si la spec toca API, bridge TS o schema de dades, actualitzar el contracte abans d'implementar cap costat.
2. **Capa per capa**: implementar segons l'ordre indicat a la spec.
3. **Commits atòmics**: cada commit ha de tenir un propòsit clar i un missatge convencional.
4. **No saltar passos**: si un pas depèn d'un altre, esperar-lo.

### 3. Tests

| Tipus | Qui | Quan |
|---|---|---|
| Unitaris | Agent owner | Després d'implementar cada component |
| Integració | Agent owner | Després dels unitaris |
| Cross-capa | Agent owner + agents afectats | Després dels d'integració |
| Regressió | Tots | Abans de cada PR |

**Cap regressió tolerada.** Si un test baseline falla, s'ha de corregir abans de continuar.

### 4. Validació de camp (si aplica)

Si la spec afecta UX, GPS, WebSocket o comportament visible:

- Planificar l'escenari mínim.
- Documentar els resultats a `docs/field-tests/<data>-<escenari>.md`.
- Adjuntar evidència (logs, captures, traça de BD) al PR.

### 5. Pull Request

1. Revisar `git status` i `git diff --stat`.
2. Fer commit amb missatge convencional.
3. Enviar la branca i crear PR cap a `develop`.
4. El body del PR ha d'incloure:
   - Enllaç a la spec.
   - Resum de canvis.
   - Tests realitzats.
   - Verificacions (baseline, build, lint).
   - Evidència de camp si aplica.

### 6. Code review

- **Auto-revisió**: l'agent owner revisa el seu codi abans de demanar review.
- **Reviewer designat**: valida que la spec s'ha complert.
- **Tech Lead**: sign-off final si la spec és cross-capa o implica ADR.

### 7. Merge

- Es fa merge només després d'aprovacions i tests verds.
- Preferiblement `squash` per mantenir historial net.
- Esborrar la branca de treball després del merge.
- Actualitzar la spec a `validated`.

### 8. Post-merge

1. Actualitzar `STATE.json` amb l'estat final de la spec.
2. Actualitzar `specs/000-index.md` si cal.
3. Si la spec formava part d'un milestone, actualitzar `ROADMAP/beta-readiness.md`.
4. Si hi ha issues d'auditoria resoltes, marcar-les com a tancades.

## Branques i commits

### Prefixos de branca

| Prefix | Ús |
|---|---|
| `feat/` | Nova funcionalitat |
| `fix/` | Correcció de bug |
| `refactor/` | Refactorització sense canvi funcional |
| `docs/` | Només documentació |
| `release/` | Branca de release |

### Prefixos de commit

| Prefix | Ús |
|---|---|
| `feat:` | Nova funcionalitat |
| `fix:` | Correcció de bug |
| `refactor:` | Canvi intern sense funcionalitat nova |
| `docs:` | Només documentació |
| `test:` | Tests sense canvi de producció |
| `chore:` | Manteniment |

Els missatges de commit han de respondre al "per què", no només al "què".

## Gestió de canvis durant l'execució

### Si la spec és incorrecta

1. **No corregir sobre la marxa**.
2. Aturar la implementació.
3. Reobrir la spec (tornar a `draft` o `review`).
4. Redactar la correcció.
5. Tornar a aprovar.

### Si apareix un bloqueig

1. Aturar el treball relacionat.
2. Documentar el bloqueig a la spec i a `STATE.json > blocked_by`.
3. Notificar al Tech Lead.
4. Esperar resolució abans de continuar.

### Si cal canviar d'abast

Qualsevol ampliació o reducció de l'abast requereix actualitzar la spec i tornar-la a aprovar.

## Finalització i tancament

Una spec es considera executada amb èxit quan:

- [ ] Tots els criteris d'acceptació són `true`.
- [ ] Els tests baseline es mantenen verds (o augmenten).
- [ ] La build és correcta.
- [ ] El reviewer ha aprovat.
- [ ] El Tech Lead ha fet sign-off (si escau).
- [ ] QA ha signat (si aplica field testing o release).

Aleshores s'actualitza l'estat a `validated` i es pot tancar.

## Rollback i rework

Si després del merge es detecta una regressió greu:

1. Obrir una issue d'auditoria.
2. Avaluar si fer revert del merge o un fix ràpid.
3. Si es fa revert, la spec torna a `approved` o `implementing` segons el cas.
4. Si es fa fix, crear una nova spec o reobrir l'original.
5. Documentar la lliçó apresa.

## Referències

- `ARCHITECT.md` — Arquitectura de governança.
- `ORCHESTRATOR.md` — Orquestració de sessions.
- `AUDIT.md` — Traçabilitat i auditoria.
- `pathguard-workflow-sdd-implement` — Skill d'implementació.
- `pathguard-workflow-sdd-validate` — Skill de validació.
- `pathguard-workflow-commit` — Convencions de commit.
- `pathguard-workflow-branching` — Convencions de branques.
