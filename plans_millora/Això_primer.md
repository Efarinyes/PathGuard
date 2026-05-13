# Pla d'Implementació - Priority Improvement Roadmap

Aquest document detallla el pla d'implementació per a les fases **"Critical now"** i **"Before Beta"** del PathGuard Project Audit.

---

# FASE 1: CRITICAL NOW

## 1.1 WebSocket Connection Leaks (Critical)

### Tasca 1.1.1 - Afegir cleanup a useLivePatientLocation
- **Localització:** `frontend/hooks/useLivePatientLocation.ts:90-98`
- **Descripció:** El useEffect que crea `CaregiverConnectionManager` no retorna funció de cleanup
- **Solució:**
```typescript
useEffect(() => {
  const processor = new WalkEventProcessor();
  connectionManagerRef.current = new CaregiverConnectionManager(
    processor,
    callbacks,
    dispatchState
  );
  return () => {
    connectionManagerRef.current?.disconnect?.();
    connectionManagerRef.current = null;
  };
}, [callbacks, dispatchState]);
```

### Tasca 1.1.2 - Verificar que CaregiverConnectionManager té mètode disconnect
- **Localització:** `frontend/lib/CaregiverConnectionManager.ts`
- **Descripció:** Assegurar que la classe implementa `disconnect()` o equivalent

### Tasca 1.1.3 - Executar tests existents
- **Comanda:** `npm test -- --testPathPattern="useWebSocket|useLivePatientLocation"`
- **Descripció:** Verificar que els tests passen

**Verificació final:**
```bash
grep -A10 "connectionManagerRef.current = new CaregiverConnectionManager" frontend/hooks/useLivePatientLocation.ts
# Ha de mostrar "return () => {" al final del useEffect
```

---

## 1.2 Error Boundaries (Critical)

### Tasca 1.2.1 - Crear MapErrorBoundary
- **Fitxer:** `frontend/components/CaregiverMap/MapErrorBoundary.tsx` (nou)
- **Descripció:** Component class-based per capturar errors del mapa
- **Implementació bàsica:**
```typescript
import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class MapErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center bg-slate-50 border rounded-xl p-6">
          <div className="text-center">
            <p className="text-slate-600 mb-3">Error carregant el mapa</p>
            <button onClick={this.handleRetry} className="btn-primary">
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

### Tasca 1.2.2 - Integrar MapErrorBoundary al CaregiverMap
- **Localització:** `frontend/components/CaregiverMap/index.tsx`
- **Descripció:** Wrappear el render del mapa amb l'ErrorBoundary

### Tasca 1.2.3 - Crear ErrorBoundary per WalkHistoryList
- **Fitxer:** `frontend/components/WalkHistoryList/ErrorBoundary.tsx` (nou)
- **Descripció:** Error boundary simple per a la llista d'historial

### Tasca 1.2.4 - Integrar WalkHistoryList ErrorBoundary
- **Localització:** `frontend/components/CaregiverDashboard/index.tsx`
- **Descripció:** Wrappear `<WalkHistoryList />` amb l'ErrorBoundary

**Verificació final:**
```bash
grep -r "ErrorBoundary" frontend/components/CaregiverMap/
grep -r "ErrorBoundary" frontend/components/WalkHistoryList/
# Tots dos han de retornar resultats
```

---

## 1.3 Environment-Based CORS Configuration (High)

### Tasca 1.3.1 - Crear fitxer .env.example
- **Fitxer:** `backend/.env.example` (nou)
- **Contingut:**
```
FRONTEND_URL=http://localhost:3000
```

### Tasca 1.3.2 - Modificar settings.py
- **Localització:** `backend/app/core/config/settings.py`
- **Descripció:** Afegir `FRONTEND_URL` com a variable de configuració

### Tasca 1.3.3 - Actualitzar main.py
- **Localització:** `backend/app/main.py:49-54`
- **Descripció:** Substituir array hardcoded per llegir de settings
```python
ALLOWED_ORIGINS = [
    settings.FRONTEND_URL,
    "http://localhost:3000",   # Dev fallback
    "http://127.0.0.1:3000",
]
```

### Tasca 1.3.4 - Documentar al README
- **Descripció:** Explicar configuració de producció

**Verificació final:**
```bash
cd backend && python -c "from app.core.config.settings import settings; print(settings.FRONTEND_URL)"
# Ha de mostrar el valor de l'entorn
```

---

## 1.4 Service Worker Versioning (High)

### Tasca 1.4.1 - Eliminar fitxers duplicats
- **Fitxers a eliminar:**
  - `frontend/public/pathguard-sw 2.js`
  - `frontend/public/pathguard-sw 3.js`
  - `frontend/public/pathguard-sw 4.js`

### Tasca 1.4.2 - Revisar configuració Workbox
- **Localització:** `frontend/next.config.js`
- **Descripció:** Assegurar que genera un sol SW amb cache versioning correcte

### Tasca 1.4.3 - Verificar build
- **Comanda:** `npm run build && ls -la frontend/public/pathguard-sw*.js`
- **Descripció:** Confirmar que només genera 1 fitxer

**Verificació final:**
```bash
ls frontend/public/pathguard-sw*.js
# Només ha de mostrar: pathguard-sw.js
```

---

# FASE 2: BEFORE BETA

## 2.1 SOS / Emergency Signaling (Critical Gap)

### Tasca 2.1.1 - Disseny UI per a pacient
- **Descripció:** Crear botó d'emergència visible però discret a la UI del pacient
- **Consideracions:**
  - Botó accessible però no obvi (evitar false alarms)
  - Feedback visual en prémer
  - Confirmació abans d'enviar

### Tasca 2.1.2 - API endpoint per a SOS
- **Localització:** `backend/app/api/routers/`
- **Descripció:** Crear endpoint `POST /api/v1/emergency/sos`
  - Rep: patient_id, timestamp, (opcional) location
  - Guarda a la base de dades com a tipus especial
  - Notifica al moment als cuidadors via WebSocket

### Tasca 2.1.3 - WebSocket event per a SOS
- **Localització:** `backend/app/api/ws_manager.py`
- **Descripció:** Afegir tipus d'event `emergency_alert` que es transmet immediatament

### Tasca 2.1.4 - UI per a cuidador
- **Descripció:** Mostrar alert prominent quan es rep SOS
  - Notificació urgent
  - Historial d'alertes al dashboard

**Verificació final:**
```bash
# Test manual:
# 1. Pacient prem SOS button
# 2. Cuidador rep notificació en temps real
# 3. Event guardat a la taula de walks/trip_events

curl -X POST http://localhost:8000/api/v1/emergency/sos \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"patient_id": 1, "latitude": 41.38, "longitude": 2.17}'
```

---

## 2.2 Walk State Recovery (High Gap)

### Tasca 2.2.1 - Persistir walk_id a localStorage
- **Localització:** `frontend/hooks/useAppState.ts`
- **Descripció:** Guardar `current_walk_id` a localStorage, no només a memòria

### Tasca 2.2.2 - Detectar reboot i restaurar walk
- **Localització:** `frontend/hooks/usePatientWalk.ts` (nou o modificar)
- **Descripció:**
  - En iniciar, comprovar si existeix `current_walk_id` a localStorage
  - Si existeix i el walk no està tancat, oferir reprendre
  - Enviar dades pendents des del darrer checkpoint

### Tasca 2.2.3 - Backend: marcar walk com a "interromput"
- **Localització:** `backend/app/api/routers/walks.py`
- **Descripció:** Afegir estat `interrupted` per a walks que no han acabat normalment

### Tasca 2.2.4 - Sincronitzar dades pendents
- **Descripció:** Rebre dades del pacient des de l'últim checkpoint coneixut

**Verificació final:**
```bash
# Test:
# 1. Pacient starts walk -> walk_id guardat a localStorage
# 2. Telèfon s'apaga
# 3. Telèfon s'encén -> app detecta walk obert a localStorage
# 4. Ofereix "Reprendre caminada" o continua automàticament
```

---

## 2.3 Battery / Device Status Reporting (Medium Gap)

### Tasca 2.3.1 - Client: Reportar battery level
- **Localització:** `frontend/hooks/usePatientStatus.ts` (nou)
- **Descripció:** Utilitzar Battery API per obtenir nivell
```typescript
navigator.getBattery().then(battery => {
  const level = Math.round(battery.level * 100);
  const charging = battery.charging;
  // Enviar al backend periòdicament
});
```

### Tasca 2.3.2 - WebSocket: Incloure battery a l'event de localització
- **Descripció:** Afegir camp `battery_level` i `is_charging` al payload de localització

### Tasca 2.3.3 - Backend: Guardar battery a la taula de localització
- **Localització:** `backend/app/api/routers/locations.py`
- **Descripció:** Modificar LocationCreate per acceptar camps opcionals

### Tasca 2.3.4 - Cuidador: Mostrar estat de bateria
- **Localització:** `frontend/components/CaregiverDashboard/`
- **Descripció:** Mostrar icona de bateria al StatusCard

**Verificació final:**
```bash
# Test:
# 1. Pacient amb 45% bateria
# 2. Envia ubicació -> battery_level: 45
# 3. Cuidador veu icona de bateria al dashboard
```

---

## 2.4 Data Export Functionality (Medium Gap)

### Tasca 2.4.1 - Backend: Endpoint export walks
- **Localització:** `backend/app/api/routers/analytics.py`
- **Descripció:** Crear `GET /api/v1/walks/export`
  - Retorna JSON o CSV amb totes les caminades
  - Inclou: dates, durades, rutes (coords), estat

### Tasca 2.4.2 - Frontend: Botó export
- **Localització:** `frontend/components/WalkHistoryList/`
- **Descripció:** Afegir botó "Exportar dades" que crida l'endpoint i baixa fitxer

### Tasca 2.4.3 - Format CSV (opcional)
- **Descripció:** OFerir opció CSV a més de JSON per a compatibilitat amb fulls de càlcul

### Tasca 2.4.4 - Limitació per permissions
- **Descripció:** Només el propietari del grup pot exportar

**Verificació final:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/walks/export
# Ha de retornar CSV/JSON amb totes les caminades de l'usuari
```

---

# SEQÜÈNCIA RECOMANADA

| Setmana | Fase | Tasques |
|---------|------|---------|
| 1 | Critical now | 1.1 WebSocket cleanup + 1.2 Error Boundaries |
| 2 | Critical now | 1.3 CORS + 1.4 Service Workers |
| 3 | Before Beta | 2.1 SOS Emergency |
| 4 | Before Beta | 2.2 Walk Recovery + 2.3 Battery Status |
| 5 | Before Beta | 2.4 Data Export + Testing |
| 6 | - | Testing集成 + Bug fixes |

---

# COMANDES DE VERIFICACIÓ GLOBALS

```bash
# WebSocket cleanup
grep -A5 "connectionManagerRef.current = new CaregiverConnectionManager" frontend/hooks/useLivePatientLocation.ts

# Error boundaries
ls -la frontend/components/CaregiverMap/MapErrorBoundary.tsx
ls -la frontend/components/WalkHistoryList/ErrorBoundary.tsx

# CORS
grep "FRONTEND_URL" backend/app/core/config/settings.py
grep "settings.FRONTEND_URL" backend/app/main.py

# Service workers
ls frontend/public/pathguard-sw*.js | wc -l
# Ha de retornar 1

# SOS
grep -r "emergency" backend/app/api/routers/
grep -r "sos" backend/app/api/

# Battery
grep -r "battery" frontend/hooks/

# Export
grep -r "export" backend/app/api/routers/
```

---

# NOTA D'IMPLEMENTACIÓ

Abans de començar qualsevol fase:
1. Crear tag de seguretat: `git tag audit-baseline-2026-05-11`
2. Crear branca de treball: `git checkout -b fix/critical-risks`
3. Fer backup: `git branch backup-pre-fixes`

Cada tasca complerta:
- Commit amb missatge descriptiu
- Push immediatament
- Verificació amb comandes de test

Si algo falla:
- Restaurar des del tag
- Investigar, resoldre, tornar a intentar