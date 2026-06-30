---
name: pathguard-sdd-implement
description: |
  Procediment per implementar una spec aprovada. Carregar
  quan s'inicia la implementació d'una feature o refactor.
triggers:
  - Spec aprovada
  - Inici d'implementació
  - Obrir branca de feature
agent_owner: <agent-owner>
prerequisites:
  - pathguard-sdd-create-spec (la spec)
  - pathguard-sdd-review-spec (aprovada)
  - pathguard-state (saber on som)
---

# SDD — Implementar una Spec

## Pre-condicions

- [ ] Spec status = `approved`
- [ ] Branca especificada a la spec
- [ ] Tests baseline verds (152/152 backend, 108/108 frontend)
- [ ] Build OK

## Procediment

### 1. Obrir branca

```bash
# Des de develop (per defecte) o main (hotfix)
git checkout develop
git pull origin develop
git checkout -b <type>/SPEC-NNN-kebab-case
```

**Mai** des de `main` o `develop` directament.

### 2. Implementar segons el pla

Seguir l'ordre de la spec, pas a pas. **No saltar passos.**

Si toques contractes (bridge TS, API):
1. **Primer** actualitzar contracte (signatura, schema)
2. **Després** implementar cada costat
3. **Finalment** tests d'integració

### 3. Tests

| Tipus | Qui | Quan |
|---|---|---|
| Unit (de la teva capa) | Tu | Després d'implementar |
| Integration | Tu | Després d'unit |
| Cross-capa | Tu + agent afectat | Després d'integration |

**Comprovar baseline:**
```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend
cd frontend && npm test && npm run build --webpack
```

**Cap regressió tolerada.**

### 4. Field testing (si aplica)

Si la spec afecta UX, GPS, o qualsevol cosa que requereix validació humana:

- Planificar 1 dispositiu + 1 escenari mínim
- Documentar a `docs/field-tests/<data>-...md`
- Passar el test abans de PR

### 5. PR

```bash
git status                    # Verificar canvis
git diff --stat               # Resum
git add <fitxers específics>  # Mai -A sense revisar
git commit -m "feat: <missatge>"
git push origin <branca>
gh pr create --base develop
```

**Títol del PR:** `<type>: <SPEC-NNN> <títol>`  
**Body del PR:**
```markdown
## Spec
SPEC-NNN: <link a specs/SPEC-NNN-...md>

## Canvis
- ...

## Tests
- [ ] Unit
- [ ] Integration
- [ ] E2E
- [ ] Field (si aplica)

## Verificacions
- [ ] Baseline tests verds
- [ ] Build OK
- [ ] Lint OK

## Screenshots/Evidència
- ...
```

### 6. Code review

| Qui revisa | Quan |
|---|---|
| Agent owner | Auto-revisió abans de PR |
| Reviewer (a spec) | Aprovació del PR |
| Tech Lead (cross-capa) | Sign-off final |

**Tots** els comentaris han de ser resposts o resolts.

### 7. Merge

```bash
# Després d'aprovació
gh pr merge --squash --delete-branch
```

**Mai** `--force` ni `--no-verify`.

## Errors comuns

❌ Implementar sense tests baseline verds
❌ Obrir branca des de `main` o `develop` directament
❌ Saltar passos del pla
❌ Commit `-A` sense revisar
❌ PR sense body
❌ Merge sense sign-off
❌ Implementar fora del teu domini (crida a Platform Integration o Tech Lead)

## Què fer si...

### ...trobessis un blocker
1. Aturar implementació
2. Documentar blocker a la spec (afegir secció "Blockers")
3. Notificar al Tech Lead
4. Esperar resolució

### ...canviïs d'agent
1. Aturar implementació
2. Notificar al Tech Lead
3. L'agent rellevant continua

### ...la spec és incorrecta
1. NO corregir sobre la marxa
2. Reobrir la spec
3. Redactar correcció
4. Tornar a revisió

## Validació final

La spec passa a `validated` quan:
- [ ] Tots els AC són `true`
- [ ] Tests verds (baseline mantingut o augmentat)
- [ ] Build OK
- [ ] Sign-off de reviewer
- [ ] Sign-off de Tech Lead (cross-capa)
- [ ] QA sign-off (si field testing)

Aleshores es tanca la spec i es pot tag/releaset.

## Recursos

- `pathguard-sdd-create-spec` (la spec)
- `pathguard-sdd-review-spec` (aprovada)
- `pathguard-sdd-validate` (següent pas)
- `pathguard-branching` (convencions branques)
- `pathguard-commit` (convencions commits)
