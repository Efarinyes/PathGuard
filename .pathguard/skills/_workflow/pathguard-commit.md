---
name: pathguard-commit
description: |
  Estil i procediment de commits. Carregar quan es fa
  commit, abans d'obrir PR.
metadata:
  triggers:
    - Fer commit
    - Preparar PR
  agent_owner: "*"
  prerequisites:
    - pathguard-conventions
---

# Commit — Estil i procediment

## Estil: Conventional Commits

| Prefix | Ús | Exemple |
|---|---|---|
| `feat:` | Nova funcionalitat | `feat: add owner-only walk detail endpoint` |
| `fix:` | Correcció de bug | `fix: prevent GPS point loss on iOS flush failure` |
| `refactor:` | Refactor intern | `refactor: extract BufferStore to separate class` |
| `docs:` | Només documentació | `docs: add SPEC-010 to spec catalog` |
| `test:` | Tests sense canvi de prod | `test: add unit tests for LocationBuffer` |
| `chore:` | Manteniment | `chore: bump capacitor to 8.3.4` |
| `style:` | Format (no lògic) | `style: format with prettier` |
| `perf:` | Performance | `perf: use index on client_id lookup` |

## Anatomia d'un bon commit

### Títol
- **Focus al "why"**, no al "what"
- Màxim 72 caràcters
- Imperatiu present ("add", "fix", "refactor")
- No punt final

### Exemples bons ✅
```
feat: add owner-only walk detail endpoint with scope check
fix: prevent GPS point loss when flush fails on iOS
refactor: extract BufferStore to separate class for testability
docs: add SPEC-010 restore-android-plugin
test: add unit tests for LocationBuffer.onFlushResult
```

### Exemples dolents ❌
```
fix: changed onFlushResult         # massa vague, no explica per què
updated code                        # ni tan sols té prefix
feat: add feat: thing               # doble prefix
fix: bug.                            # punt final innecessari
```

## Body del commit (opcional però recomanat)

```
feat: add owner-only walk detail endpoint

GET /walks/{id}/locations now requires is_owner=true.
Caregivers without owner role get 403.

Refs: SPEC-XXX
```

## Procediment

```bash
# 1. Verificar què canviarà
git status
git diff --stat

# 2. Stage específic (mai -A sense revisar)
git add <file1> <file2>
# o
git add <directory>

# 3. Verificar staged
git diff --cached --stat

# 4. Commit
git commit -m "<prefix>: <title>

<body opcional>

Refs: SPEC-NNN"

# 5. Push
git push origin <branca>
```

## Regles

1. **Mai** `git add -A` sense revisar (pot afegir fitxers secrets o .DS_Store)
2. **Mai** `--no-verify` (saltar hooks)
3. **Mai** `--amend` després de push (reescriu historial)
4. **Mai** `--force` (excepte rebase local no pushat)
5. **Sempre** un commit per canvi lògic
6. **Sempre** reference a SPEC-NNN si aplica

## Validació pre-commit

- [ ] `git status` net excepte canvis intencionats
- [ ] `git diff --stat` mostra canvis esperats
- [ ] Cap secret al diff
- [ ] Cap `.DS_Store`, `node_modules`, etc.
- [ ] Prefix correcte
- [ ] Títol < 72 caràcters
- [ ] Body si cal explicar "why"

## Pre-commit hook (recomanat)

A `.git/hooks/pre-commit` o via `pre-commit` Python:

```bash
#!/bin/bash
# Evitar .DS_Store
git diff --cached --name-only | grep -E '\.DS_Store$' && {
  echo "ERROR: .DS_Store al diff"
  exit 1
}

# Evitar secrets
git diff --cached | grep -iE '(password|secret|api_key|token)\s*=\s*["\047][^"\047]+["\047]' && {
  echo "ERROR: possible secret al diff"
  exit 1
}
```

## Recursos

- `pathguard-conventions` (convencions generals)
- `pathguard-branching` (branches)
- Conventional Commits: https://www.conventionalcommits.org/
