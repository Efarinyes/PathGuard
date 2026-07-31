# Archive branch — OpenCode governance (pre-Cursor migration)

**Branch:** `archive/opencode-governance-2026-07-30`  
**Created from:** `develop` @ `c26c677` (2026-07-30)  
**Purpose:** Preserve the original OpenCode agent configuration as historical reference.

## What this branch contains

- `.opencode/skills/` — 20 active skills + archive
- `.opencode/governance/` — ARCHITECT, MODEL_ROLES, ORCHESTRATOR, etc.
- `AGENTS.md` with OpenCode `skill({ name: "..." })` invocation

## How to inspect without checking out

```bash
git show archive/opencode-governance-2026-07-30:.opencode/skills/pathguard-core-state/SKILL.md
git ls-tree -r --name-only archive/opencode-governance-2026-07-30 -- .opencode/
```

## Migration

The Cursor-native setup lives on `refactor/migrate-opencode-to-cursor` (merged to `develop` when approved).

See `docs/governance/MIGRATION-FROM-OPENCODE.md` on the migration branch.
