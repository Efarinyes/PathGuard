# ADR-0001: Dual Database Strategy (SQLite dev + PostgreSQL prod)

## Status

`accepted` — 2026-05-31 (Phase G)

## Context

PathGuard té dos entorns:
- **Local dev** — desenvolupadors individuals, volen rapidesa i zero-setup
- **Producció** — Render.com, volen persistència i escalabilitat

Necessitem una estratègia que permeti:
1. Dev local ràpid amb SQLite (no cal servidor PostgreSQL)
2. Tests ràpids amb SQLite in-memory
3. Producció robusta amb PostgreSQL
4. **Mateix codi** per ambdós (no duplicació)

## Decision

Adoptem **dual database strategy**:

- **Dev local:** SQLite a `backend/pathguard.db`
- **Tests:** SQLite in-memory (`:memory:`)
- **Producció:** PostgreSQL via Supabase (Supavisor pooler IPv4)

Connexió configurable via `DATABASE_URL` env var.

Codi cross-dialecte allà on calgui:

```python
if 'postgresql' in str(db.bind.url):
    # PostgreSQL-specific
else:
    # SQLite fallback
```

## Alternatives considerades

### A. Només PostgreSQL
- ✅ Un sol codi
- ❌ Setup dev complex (cal instal·lar PG)
- ❌ Tests lents

### B. Només SQLite
- ✅ Zero setup
- ❌ No escala a producció
- ❌ No suporta UUID natiu, JSONB, etc.

### C. **Dual database (escollida)**
- ✅ Dev ràpid
- ✅ Tests ràpids
- ✅ Producció robusta
- ⚠️ Cal gestionar cross-dialecte

## Consequences

### Positives
- Zero setup per a nous desenvolupadors
- Tests ràpids (SQLite in-memory)
- Producció escalable (PostgreSQL)
- Un sol codi base

### Negatives
- Cross-dialecte cal gestionar-lo (funcions específiques de PG)
- Validació en CI ha de cobrir ambdós
- Debugging pot ser diferent

### Mitigacions
- Helper `upsert_location()` amb fallback
- Tests que validin ambdós dialectes
- Documentació clara a `pathguard-backend-stack.md`

## Implementation

- `backend/app/db/session/database.py` — engine basat en `DATABASE_URL`
- `backend/app/services/location_service.py` — `upsert_location` amb fallback
- Tests: `pytest tests/ -v` (SQLite in-memory per defecte)

## References

- `docs/FASE-G-POSTGRESQL-MIGRATION.md` (arxivat)
- `.pathguard/skills/_domain/pathguard-backend-stack.md`
- [Supabase docs](https://supabase.com/docs)
