# Fase G — Migració a PostgreSQL

**Data:** 2026-05-31  
**Basada en:** `docs/PRIMERA-APROXIMACIO-CAP-A-BETA-ESTABLE.md`  
**Alineada amb la filosofia PathGuard:** *Calm, discreta, fiable — no clínica, no invasiva.*

---

## Problema

SQLite a Render **no persisteix dades entre restarts** (cada desplegament/netejada esborra la BD). El cuidador/owner no pot:
1. Conservar l'historial de passejades entre restarts del servidor
2. Consultar la base de dades externament per veure analítiques o depurar
3. Fer proves reals amb continuïtat (cada restart del backend es perd tot)

## Objectiu

Migrar de SQLite (desenvolupament local) a PostgreSQL (producció a Render) mantenint SQLite per a desenvolupament local i tests.

## Decisió: Dual DB (SQLite local, PostgreSQL producció)

**El backend funcionarà amb qualsevol base de dades SQLAlchemy-compatible**, seleccionada via `DATABASE_URL`:

| Entorn | Base de dades | Configuració |
|--------|--------------|--------------|
| **Local (dev)** | SQLite (`pathguard.db`) | `DATABASE_URL` no definida (default) |
| **Tests (pytest)** | SQLite (`:memory:`) | Hardcoded al `conftest.py` |
| **Producció (Render)** | PostgreSQL (Supabase) | `DATABASE_URL` via env var |

**Per què SQLite a local?**
- El frontend (React) és completament desacoblat de la BD — parla amb l'API REST/WS
- SQLAlchemy abstrau les diferències entre SQLite i PostgreSQL
- Les proves cosmètiques (UI, disseny) no toquen la BD
- La migració real de dades només cal fer-la un cop (de SQLite a PostgreSQL) o començar de zero a producció

---

## Anàlisi tècnica prèvia

### Estat actual del backend

| Aspecte | Fitxer | Compatible amb PostgreSQL? |
|---------|--------|---------------------------|
| `DATABASE_URL` configurable | `backend/app/core/config/settings.py:26` | ✅ Per defecte SQLite, es canvia amb env var |
| `check_same_thread` (SQLite només) | `backend/app/db/session/database.py:9-10` | ✅ Condicional — només s'aplica a SQLite |
| Driver PostgreSQL | `requirements.txt` | ❌ **No hi ha `psycopg2`** — cal afegir-lo |
| Models: `DateTime` sense timezone | Tots els models | ⚠️ Funciona, però PostgreSQL prefereix `timezone=True` |
| Models: `Boolean default=` | Walk, Patient, Group, etc. | ✅ Python-side default funciona amb PostgreSQL |
| Models: `String(36)` per UUIDs | Patient.device_token | ✅ Compatible |
| Models: `String(6)` per codis | Patient.activation_code, InvitationCode.code | ✅ Compatible |
| Models: `Float` per coordenades | Location | ✅ Compatible |
| Taula `user` (reserved keyword) | `Base.__tablename__` automàtic | ⚠️ PostgreSQL té `user` com a paraula reservada, però SQLAlchemy l'entrecomilla automàticament |

### Models a revisar per `DateTime` + timezone

Totes les columnes `DateTime` actuals no tenen `timezone=True`. Quan s'inserta un `datetime` amb tz (ex: `datetime.now(timezone.utc)`) en una columna PostgreSQL `TIMESTAMP WITHOUT TIME ZONE`, SQLAlchemy mostra un warning i converteix a naive. **No trenca res**, però no és ideal.

| Model | Columna | Default | Risc |
|-------|---------|---------|------|
| `Walk` | `start_time` | `None` (requerit) | ⚠️ Baix — es passa sempre un datetime amb tz |
| `Walk` | `end_time` | `None` (nullable) | ⚠️ Baix |
| `Location` | `timestamp` | `None` (requerit) | ⚠️ Baix |
| `Patient` | `created_at` | `datetime.now(timezone.utc)` | ⚠️ Baix |
| `Group` | `created_at` | `datetime.now(timezone.utc)` | ⚠️ Baix |
| `InvitationCode` | `expires_at` | `datetime.now(timezone.utc) + timedelta(days=7)` | ⚠️ Baix |
| `InvitationCode` | `created_at` | `datetime.now(timezone.utc)` | ⚠️ Baix |

---

## Pla d'execució

### G.1 — Afegir driver PostgreSQL

**Fitxer:** `backend/requirements.txt`

```diff
+ psycopg2-binary==2.9.10
```

`psycopg2-binary` és el driver PostgreSQL estàndard per a Python. S'instal·la com a binari precompilat (no cal compilar res). Per a producció a Render, `psycopg2` (sense binary) és preferible, però `-binary` és suficient per a la beta.

**Commit:** `feat: add psycopg2-binary for PostgreSQL support`

### G.2 — Refactoritzar `database.py` per a PostgreSQL

**Fitxer:** `backend/app/db/session/database.py`

L'única línia específica de SQLite és el `check_same_thread`. Ja és condicional, així que amb PostgreSQL es connecta sense el flag. **No cal canviar res — ja funciona.**

Verificació: si `DATABASE_URL` comença per `postgresql://`, el bloc `if` no s'executa i `connect_args` queda buit.

### G.3 — Afegir `timezone=True` a les columnes DateTime (recomanat, no crític)

**Fitxers:** Tots els models amb `DateTime`

**Canvi:** `Column(DateTime)` → `Column(DateTime(timezone=True))`

Això garanteix que PostgreSQL emmagatzemi les dates amb informació de zona horària (`TIMESTAMPTZ`). Millor pràctica, però **no crític** per al funcionament.

**Risc:** Si es canvia després de crear les taules, cal migrar les dades existents (ALTER COLUMN). Més senzill: fer-ho **abans** de `create_all()` a la BD de producció.

**Decisió:** Fer-ho dins d'aquesta fase (ara o mai). Millor incloure-ho que ajornar-ho.

### G.4 — Crear projecte Supabase

Passos manuals (cal fer-ho al navegador):

1. Anar a https://supabase.com → Sign up/Login
2. Create new project → "PathGuard" (o similar)
3. Escollir regió propera (EU-West o similar)
4. Copiar la **Connection string (URI)** de Settings → Database → URI

La URI té el format:
```
postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
```

### G.5 — Configurar `DATABASE_URL` a Render

**Lloc:** Render Dashboard → PathGuard backend → Environment Variables

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres:...@...supabase.co:5432/postgres` |

**Nota:** `SECRET_KEY` ja està configurada a Render. No tocar.

### G.6 — Verificació de connexió i desplegament

**Passos:**
1. Deploy a Render des de `main`
2. Comprovar logs: `INFO: PathGuard backend starting...`
3. Provar `POST /auth/register` → ha de crear usuari + grup a PostgreSQL
4. Provar `GET /auth/me` → ha de retornar les dades de l'usuari
5. Provar un cicle complet: registre → login → activació → iniciar passeig → enviar ubicacions → aturar → veure historial

### G.7 — Netejar `pathguard.db` (opcional)

Un cop PostgreSQL funcioni a producció, el fitxer `backend/pathguard.db` local ja no es puja ni s'usa a Render. Es pot:

```bash
# Opcional: esborrar la BD local per començar de zero
rm backend/pathguard.db
python backend/init_db.py  # Recrea amb SQLite (per a dev local)
```

---

## Tests

### Tests existents (no cal canviar-los)

Els tests de pytest (`backend/tests/`) usen **SQLite in-memory** (`sqlite:///:memory:`). Això és correcte i desitjable:
- Els tests han de ser ràpids i aïllats
- No necessiten PostgreSQL per passar
- SQLAlchemy abstrau les diferències

**Comprovació:** Executar els tests després dels canvis:
```bash
cd backend
micromamba activate tracker-env
python -m pytest tests/ -v
```

### Tests nous (opcionals)

| Test | Què verifica | On |
|------|-------------|-----|
| Connexió PostgreSQL | Que la URI és vàlida i la BD respon | Manual (un cop a Render) |
| CRUD bàsic | Que `create_all()`, insert, query funcionen amb PostgreSQL | Manual (un cop a Render) |

**No calen tests automatitzats amb PostgreSQL** — el risc és baix i la configuració de CI/CD no justifica la complexitat per a la beta.

---

## Flux d'arquitectura final (beta)

```
Vercel (frontend PWA)
  │
  ├── fetch/WS → Render (FastAPI + WebSocket)
  │                      │
  │                      └── connect → Supabase PostgreSQL
  │
  └── Contacte directe (el frontend no canvia)

El cuidador/owner consulta dades via:
  - GET /api/v1/walks/   (historial)
  - GET /api/v1/analytics/ (estadístiques)
  - Supabase Table Editor  (debug/consulta externa)
```

---

## Resum de la Fase G

| Sub-task | Què | Fitxer | Esforç | Risc |
|----------|-----|--------|--------|------|
| G.1 | Afegir `psycopg2-binary` | `requirements.txt` | 1 minut | Molt baix |
| G.2 | Revisar `database.py` | `session/database.py` | 5 minuts (ja funciona) | Molt baix |
| G.3 | Afegir `timezone=True` a DateTime | Tots els models | 15 minuts | Baix |
| G.4 | Crear projecte Supabase | Navegador | 10 minuts | Baix (manual) |
| G.5 | Configurar env var a Render | Dashboard Render | 2 minuts | Molt baix |
| G.6 | Verificar connexió | Render logs + API | 15 minuts | Mitjà |
| G.7 | Netejar `pathguard.db` | Local | 1 minut | Molt baix |

**Estimació total:** 30-60 minuts (majoritàriament configuració i verificació)  
**Branca:** `feat/postgresql-migration`  
**Risc global:** Mitjà (baix tècnicament — el risc principal és que Render/Supabase tinguin algun problema de xarxa o autenticació)

---

## Pregunta: SQLite per a desenvolupament local?

**Sí, SQLite és suficient per a desenvolupament i proves cosmètiques.**

Raons:
1. El frontend (React) es connecta a l'API REST/WS — no sap quina BD hi ha al darrere
2. SQLAlchemy tradueix les queries al dialecte correcte automàticament
3. Les proves cosmètiques (UI, disseny, canvis de color, layout) no afecten la BD
4. Els tests pytest usen SQLite in-memory — no canviarà
5. El 99% de les operacions de BD són `INSERT`/`SELECT`/`UPDATE` bàsiques — idèntiques entre SQLite i PostgreSQL

**Única excepció:** Si s'afegeix una feature que faci servir funcionalitats PostgreSQL-específiques (ex: `JSONB`, `ARRAY`, `FULLTEXT SEARCH`), aleshores caldria PostgreSQL a local. Per a la beta, no necessitem res d'això.
