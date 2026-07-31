# Migració OpenCode → Cursor

**Data:** 2026-07-30  
**Branca de migració:** `refactor/migrate-opencode-to-cursor`  
**Branca d'arxiu (configuració OpenCode original):** `archive/opencode-governance-2026-07-30`

## Què s'ha mogut

| Abans (OpenCode) | Després (Cursor) |
|---|---|
| `.opencode/skills/` | `.cursor/skills/` |
| `.opencode/governance/` | `docs/governance/` |
| `skill({ name: "..." })` | Llegir `SKILL.md` + rules `.cursor/rules/` |
| Frontmatter `metadata.triggers` | Fusionat al camp `description` |

## Com recuperar la configuració antiga

```bash
git fetch origin
git checkout archive/opencode-governance-2026-07-30
# o només inspeccionar:
git show archive/opencode-governance-2026-07-30:.opencode/skills/pathguard-core-state/SKILL.md
```

## Script de migració

`scripts/migrate-opencode-to-cursor.py` — útil si cal re-aplicar transformacions de frontmatter (no cal en ús normal).

## Rules Cursor creades

- `pathguard-bootstrap.mdc` — alwaysApply
- `pathguard-frontend.mdc` — `frontend/**/*.{ts,tsx,css}`
- `pathguard-backend.mdc` — `backend/**/*.py`
- `pathguard-android.mdc` — Android native paths
- `pathguard-ios.mdc` — iOS native paths
- `pathguard-platform.mdc` — bridge + capacitor config
