---
name: pathguard-branching
description: |
  Convencions i procediment de branching. Carregar quan
  s'obre/modifica una branca o es planifica un release.
triggers:
  - Obrir branca
  - Planificar release
  - Decidir prefix
agent_owner: "*"
prerequisites:
  - pathguard-conventions
---

# Branching — Convencions

## Model de branques

```
main (producció)
  │
  ├── release/v*.*.*  (snapshot, opcional)
  │
  └── develop (integració)
        │
        ├── feat/SPEC-NNN-...
        ├── fix/SPEC-NNN-...
        ├── refactor/SPEC-NNN-...
        ├── docs/SPEC-NNN-...
        └── safety/... (rares)
```

## Regles

1. **Mai** commit directe a `main` o `develop`
2. **Sempre** branca de treball + PR
3. **Excepció:** usuari pot commit directe a `main` per deploy Vercel
4. **Branques curtes** — tancar quan es fusiona
5. **Nom descriptiu** — `feat/SPEC-020-consolidate-gps-capture`

## Prefixos

| Prefix | Ús | Exemple |
|---|---|---|
| `feat/` | Nova funcionalitat | `feat/SPEC-030-device-token-revocation` |
| `fix/` | Correcció de bug | `fix/SPEC-010-restore-android-plugin` |
| `refactor/` | Refactor intern | `refactor/SPEC-040-extract-buffer-store` |
| `docs/` | Només documentació | `docs/SPEC-001-update-context` |
| `release/` | Snapshot | `release/v2.7.0-beta.1` |
| `safety/` | Experiment d'alt risc | `safety/spike-kalman-filter` |

## Obrir branca

```bash
# Per defecte des de develop
git checkout develop
git pull origin develop
git checkout -b feat/SPEC-NNN-kebab-case

# Hotfix des de main
git checkout main
git pull origin main
git checkout -b fix/SPEC-NNN-kebab-case
```

## Tancar branca

```bash
# Després de merge
git checkout develop
git pull origin develop
git branch -d feat/SPEC-NNN-kebab-case
git push origin --delete feat/SPEC-NNN-kebab-case
```

## Release branches

Per a releases importants:

```bash
# Des de develop, quan tot és llest
git checkout develop
git pull origin develop
git checkout -b release/v2.7.0-beta.1

# ... només bugfixes puntuals ...

git checkout main
git merge --no-ff release/v2.7.0-beta.1
git tag -a v2.7.0-beta.1 -m "Release 2.7.0-beta.1"
git push origin main --tags

# Tornar a develop
git checkout develop
git merge --no-ff release/v2.7.0-beta.1
git branch -d release/v2.7.0-beta.1
```

## Errors comuns

❌ `git add -A` sense revisar
❌ `git push --force` (mai en main)
❌ Obrir branca des de `main` o `develop` directament (ja hi ets)
❌ Branques amb noms no descriptius (`fix/bug`, `feat/new`)
❌ Branques orfes (no mergejades mai)
❌ Merge amb `--no-verify` (saltar hooks)

## Validació

- [ ] Branca té prefix correcte
- [ ] Branca té SPEC-NNN al nom
- [ ] Branca s'ha obert des de develop (o main per hotfix)
- [ ] PR obert cap a develop (o main per hotfix)
- [ ] Tancada quan mergejada

## Recursos

- `pathguard-conventions` (convencions generals)
- `pathguard-commit` (estil de commits)
- `pathguard-sdd-implement` (procediment)
