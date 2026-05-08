# PathGuard Project Roadmap

**Darrera actualització:** 2026-05-08
**Branca actual:** `develop`

---

## Estat General

| Fase | Estat | Prioritat | Esforç |
|------|-------|-----------|--------|
| Phase A: Port Features | ✅ Completada | P0 | 6h |
| Phase B: Technical Debt | ✅ Completada | P1 | 12h |
| Phase C: Architecture | ✅ Completada | P2 | 10h |
| **Phase D: PWA Hardening** | ⏳ **Pendent** | P3 | 6h |

---

## Fases Completades

### Phase A: Port Features ✅
*Totes les funcionalitats del simulador portades a develop*

| Tasca | Descripció | Estat |
|-------|-------------|-------|
| A.1 | Port `is_recovered` column a backend | ✅ |
| A.2 | Port `is_recovered` a schemas i endpoints | ✅ |
| A.3 | Port `BATCH_LOCATION_UPDATE` a WalkEventProcessor | ✅ |
| A.4 | Port segment-based rendering (dashed amber lines) | ✅ |
| A.5 | Port `is_recovered` a frontend transport types | ✅ |
| A.6 | Port Skeleton loading component | ✅ |
| A.7 | Port PWA assets and manifest | ✅ |
| A.8 | Port WebSocket debounce optimization | ✅ |
| A.9 | Port offlineSyncService improvements | ✅ |

### Phase B: Technical Debt ✅
*Deute tècnic eliminat a develop*

| Tasca | Descripció | Estat |
|-------|-------------|-------|
| B.1 | Consolidar codi de seguretat duplicat | ✅ |
| B.2 | Eliminar fitxers dead code | ✅ |
| B.3 | Centralitzar configuració frontend | ✅ |
| B.4 | Substituir `datetime.utcnow()` deprecada | ✅ |
| B.5 | Afegir `__init__.py` faltants | ✅ |
| B.6 | Eliminar tipus `any` al frontend (72 instàncies) | ✅ |
| B.7 | Estandaritzar paths d'importació | ✅ |
| B.8 | Eliminar `get_db()` duplicat | ✅ |
| B.9 | Eliminar endpoint `/login` duplicat | ✅ |
| B.10 | Corregir response shapes inconsistents | ✅ |
| B.11 | Millorar exception handling | ✅ |
| B.12 | Harden SECRET_KEY configuration | ✅ |

### Phase C: Architecture ✅
*Millores estructurals*

| Tasca | Descripció | Estat |
|-------|-------------|-------|
| C.1 | Extract service layer from routers | ✅ |
| C.2 | Documentar limitacions WalkStateCache | ✅ |
| C.3 | Database migrations (Alembic) | ⏸️ **Ajornat** |

---

## Fases Pendents

### Phase D: PWA Hardening ⏳

| Tasca | Descripció | Prioritat | Estat |
|-------|-------------|-----------|-------|
| D.1 | SW registration conflict fix | Alta | ⬜ |
| D.2 | Offline fallback page | Alta | ⬜ |
| D.3 | Sync status API endpoint | Mitjana | ⬜ |
| D.4 | Cache-Control headers | Baixa | ⬜ |
| D.5 | Error boundary per PWA | Mitjana | ⬜ |

### Phase D Detalls

#### D.1: SW Registration Conflict Fix
**Arxiu:** `frontend/app/layout.tsx:52-73`
**Problema:** Dues mètodes de registre del Service Worker en conflicte
**Solució:** Mantenir script inline, fer localhost configurable via `.env`

#### D.2: Offline Fallback Page
**Nou arxiu:** `frontend/app/offline/page.tsx`
**Contingut:** "You are offline. Check your connection."
**Afegir a:** SW precache list a `next.config.ts`

#### D.3: Sync Status API Endpoint
**Endpoint:** `GET /api/v1/sync/status`
**Resposta:** `{ pending_count: number, last_sync: string | null }`
**Ús:** Indicador de progrés de sincronització al client

#### D.4: Cache-Control Headers
- Icons/screenshots: `Cache-Control: public, max-age=31536000, immutable`
- API responses: `Cache-Control: no-cache` o `no-store`
- SW file: `Cache-Control: no-cache` (sempre buscar actualitzacions)

#### D.5: Error Boundary per PWA
- React ErrorBoundary per a errors de renderització offline
- Graceful degradation quan IndexedDB no està disponible
- Missatge d'error quan característiques PWA crítiques fallen

---

## Tasques Post-Producció

Aquestes tasques es implementaran quan es compliqui algun trigger:

### Alembic Migrations (PostgreSQL Required)
**Trigger:** PostgreSQL provesit + Beta release planificat

Quan implementar (veure `ACTION_PLAN.txt` secció C.3):
1. PostgreSQL configurat i `DATABASE_URL` actualitzat
2. `pip install alembic && alembic init alembic`
3. Crear migració inicial: `alembic revision --autogenerate -m "initial"`
4. Aplicar: `alembic upgrade head`
5. Treure `Base.metadata.create_all()` de `main.py`

### Redis Cache (Horizontal Scaling)
**Trigger:** Desplegament amb múltiples gunicorn workers

**Problema actual:** `WalkStateCache` és in-memory, no compartit entre processos
**Solució:** Substituir per Redis per a estat compartit

---

## Progrés Visual

```
Phase A (Port Features):     [██████████████] 100% ✅
Phase B (Technical Debt):    [██████████████] 100% ✅
Phase C (Architecture):      [██████████████] 100% ✅
Phase D (PWA Hardening):     [░░░░░░░░░░░░░░]   0% ⬜
```

---

## Tests Status

| Suite | Resultat |
|-------|----------|
| Backend (pytest) | ✅ 149 passed |
| Frontend (vitest) | ✅ 108 passed / 6 skipped |

**Skipped tests (cal fixar):** Tests de `useLivePatientLocation` (A1, A2, B1, B5, C4, D4)
- **Causa:** Refactoring de WalkEventProcessor canvià l'estructura del payload
- **Solució:** Actualitzar mocks de `makeActiveWalkResponse()` a `useLivePatientLocation.test.ts`

---

## Document de Referència

Per a detalls d'implementació, veure: **`ACTION_PLAN.txt`**

---

*Generat automàticament basant-se en ACTION_PLAN.txt - 2026-05-08*