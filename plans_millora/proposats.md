# Pla d'Actuació - Critical Risks (Punt 3 del PathGuard Project Audit)

---

## Introducció

Aquest document detallat proposa un pla d'actuació per implementar les millores identificades al punt 3 del document `PathGuard_Project_Audit.md`. El pla està organitzat per fases segons la severitat i prioritat de cada tasca.

---

## Fase 1: WebSocket Connection Leaks (Critical)

**Objectiu:** Arreglar memory leaks i assegurar neteja correcta de connexions WebSocket.

### Tasca 1.1 - Afegir cleanup al CaregiverConnectionManager
- **Localització:** `frontend/hooks/useLivePatientLocation.ts:90-98`
- **Descripció:** El useEffect que crea `CaregiverConnectionManager` no retorna una funció de cleanup, provocant un memory leak.
- **Solució:** Afegir `return () => { connectionManagerRef.current = null; };` al final del useEffect.

### Tasca 1.2 - Revisar visibility handler cleanup
- **Localització:** `frontend/hooks/useLivePatientLocation.ts:141-152`
- **Descripció:** Verificar que el handler de `visibilitychange` fa cleanup adequadament quan les dependències canvien.

### Tasca 1.3 - Executar tests
- **Comanda:** `npm test -- useWebSocket.test.ts useLivePatientLocation.test.ts`
- **Descripció:** Verificar que els tests existents passen i que el comportament és correcte.

**Verificació:**
```bash
grep -n "connectionManagerRef" frontend/hooks/useLivePatientLocation.ts
```
Ha de mostrar cleanup al return de useEffect.

---

## Fase 2: Error Boundaries (Critical)

**Objectiu:** Afegir error boundaries a components d'alt risc per evitar que un sol error enfoqui tota l'aplicació.

### Tasca 2.1 - Crear MapErrorBoundary
- **Fitxer:** `frontend/components/CaregiverMap/MapErrorBoundary.tsx` (nou)
- **Descripció:** Crear un component class-based que captura errors del render del mapa.
- **Implementació:**
```typescript
import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class MapErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[400px] rounded-xl flex items-center justify-center bg-slate-50 border border-slate-200">
          <div className="text-center p-6">
            <p className="text-slate-600 font-medium mb-3">Error carregant el mapa</p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### Tasca 2.2 - Integrar MapErrorBoundary
- **Localització:** `frontend/components/CaregiverMap/index.tsx`
- **Descripció:** Wrappear `<DynamicMapRenderer />` amb `MapErrorBoundary`.

### Tasca 2.3 - Crear ListErrorBoundary per WalkHistoryList
- **Fitxer:** `frontend/components/WalkHistoryList/ErrorBoundary.tsx` (nou)
- **Descripció:** Crear un error boundary senzill per l'historial de caminades.

### Tasca 2.4 - Integrar ListErrorBoundary al Dashboard
- **Localització:** `frontend/components/CaregiverDashboard/index.tsx`
- **Descripció:** Wrappear `<WalkHistoryList />` amb el nou error boundary.

### Tasca 2.5 - Verificar PWAErrorBoundary
- **Localització:** `frontend/app/layout.tsx:87-94`
- **Descripció:** Confirmar que el PWAErrorBoundary segueix wrapant tota l'aplicació.

**Verificació:** Crear test que simuli error al render del mapa i verificar que mostra UI d'error sense crash.

---

## Fase 3: Hardcoded Localhost Origins (High)

**Objectiu:** Implementar configuració CORS basada en entorn per evitar errors al deploy.

### Tasca 3.1 - Crear .env.example
- **Fitxer:** `backend/.env.example` (nou)
- **Descripció:** Crear exemple de variables d'entorn.

### Tasca 3.2 - Modificar main.py
- **Localització:** `backend/app/main.py:49-54`
- **Descripció:** Modificar per llegir `FRONTEND_URL` de l'entorn enlloc de tenir valors hardcoded.

### Tasca 3.3 - Afegir variable a settings.py
- **Fitxer:** `backend/app/core/config/settings.py`
- **Descripció:** Afegir `FRONTEND_URL` a la configuració.

### Tasca 3.4 - Preparar .env per producció
- **Fitxer:** `.env` (nou, no versionar)
- **Descripció:** Crear fitxer amb URL de producció abans del deploy.

### Tasca 3.5 - Documentar configuració
- **Fitxer:** `README.md`
- **Descripció:** Explicar com configurar per producció.

**Verificació:**
```bash
python -c "from app.core.config.settings import settings; print(settings.FRONTEND_URL)"
```

---

## Fase 4: Service Worker Versioning (High)

**Objectiu:** Consolidar fitxers de service worker i implementar versioning adequat.

### Tasca 4.1 - Eliminar fitxers innecessaris
- **Fitxers a eliminar:**
  - `frontend/public/pathguard-sw 2.js`
  - `frontend/public/pathguard-sw 3.js`
  - `frontend/public/pathguard-sw 4.js`
- **Descripció:** Eliminar versions antigues/duplicades del service worker.

### Tasca 4.2 - Revisar next.config.js
- **Fitxer:** `frontend/next.config.js`
- **Descripció:** Verificar configuració del service worker.

### Tasca 4.3 - Verificar Workbox
- **Descripció:** Confirmar que Workbox genera el SW correctament al build.

### Tasca 4.4 - Afegir script de versioning
- **Fitxer:** `package.json`
- **Descripció:** Afegir script que versiona el SW automàticament.

**Verificació:**
```bash
ls frontend/public/pathguard-sw*.js
```
Només ha de mostrar 1 fitxer.

---

## Fase 5: Database Initialization (Medium)

**Objectiu:** Eliminar la creació de taules a cada startup del servidor.

### Tasca 5.1 - Eliminar create_all de main.py
- **Localització:** `backend/app/main.py:37`
- **Descripció:** Eliminar `Base.metadata.create_all(bind=engine)` del lifespan.

### Tasca 5.2 - Mantenir init_db.py
- **Fitxer:** `backend/init_db.py`
- **Descripció:** Mantenir per a inicialització manual de la base de dades.

### Tasca 5.3 - Documentar procés de migració
- **Fitxer:** `README.md`
- **Descripció:** Explicar com inicialitzar la base de dades manualment.

**Verificació:**
```bash
grep "create_all" backend/app/main.py
```
No ha de retornar resultats.

---

## Fase 6: Input Validation (Medium)

**Objectiu:** Validar el rang de coordenades GPS rebudes a l'API.

### Tasca 6.1 - Afegir validators a LocationCreate
- **Localització:** `backend/app/api/routers/locations.py:17-24`
- **Descripció:** Afegir Pydantic field validators per validar latitud i longitud.

### Tasca 6.2 - Validator per latitud
- **Rang:** -90 a 90 graus

### Tasca 6.3 - Validator per longitud
- **Rang:** -180 a 180 graus

### Tasca 6.4 - Crear tests
- **Fitxer:** `backend/tests/test_locations.py` (nou si no existeix)
- **Descripció:** Tests per coordenades vàlides i invàlides.

**Verificació:**
```bash
pytest tests/test_locations.py -v
```

---

## Fase 7: Analytics N+1 Queries (Medium)

**Objectiu:** Optimitzar les consultes d'analítica per evitar el problema N+1.

### Tasca 7.1 - Analitzar endpoint
- **Fitxer:** `backend/app/api/routers/analytics.py`
- **Endpoint:** `/api/v1/analytics/summary`
- **Descripció:** Identificar les consultes que es fan en loop.

### Tasca 7.2 - Identificar consultes problemàtiques
- **Descripció:** Fer log de les consultes SQL per veure quantes es fan.

### Tasca 7.3 - Refactoritzar
- **Descripció:** Convertir consultes en loop a consulta única amb JOINs.

### Tasca 7.4 - Verificar funcionament
- **Descripció:** Comparar resultats abans i après de la refactorització.

**Verificació:** Log SQL mostra 1-2 queries enlloc de N+1.

---

## Seqüància d'Implementació Recomanada

| Setmana | Fas | Descripció |
|---------|-----|-------------|
| 1 | 1 + 2 | WebSocket cleanup + Error Boundaries |
| 2 | 3 + 4 | CORS configuració + Service Worker |
| 3 | 5 + 6 | DB Initialization + Input Validation |
| 4 | 7 + Testing | Analytics optimization + Testing集成 |

---

## Comandes de Verificació Post-Implementació

```bash
# WebSocket cleanup
grep -A5 "connectionManagerRef" frontend/hooks/useLivePatientLocation.ts

# Error boundaries
grep -r "ErrorBoundary" frontend/components/

# CORS config
cat backend/.env | grep FRONTEND

# Service workers
ls frontend/public/pathguard-sw*.js

# DB init
grep "create_all" backend/app/main.py

# Validation
grep -A10 "class LocationCreate" backend/app/api/routers/locations.py
```

---

## Notes Addicionals

- **Abans de modificar:** Crear branca Git i tag seguint les recomanacions del document d'auditoria (`audit-baseline-2026-05-11`).
- **Testing:** Executar tests complets abans de cada commit.
- **Documentació:** Actualitzar README.md amb els canvis de configuració.
- **Rollback:** Si algo falla, restaurar des del tag creat.

---

## Referències

- Document original: `PathGuard_Project_Audit.md`
- branca segura: `pre-websocket-fix` (crear abans de modificar hooks)
- branca segura: `pre-error-boundary-add` (crear abans de modificar components)