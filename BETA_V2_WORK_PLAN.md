# 🛡️ PathGuard Beta V2: Pla d'Actuació Mestre

Aquest document unifica totes les auditories i plans previs per portar PathGuard a un estat "exportable" i segur per a proves en entorns reals.

## 📌 Principis Rectors
1.  **SOLID**: Refactoritzar components saturats (com `CaregiverDashboard`) en peces amb Responsabilitat Única.
2.  **Clean Code**: Eliminació de "magic strings", tipats `any` restants i gestió d'errors mitjançant Error Boundaries.
3.  **Zero Deute Tècnic**: Resolució de memory leaks (WebSockets) i optimització de consultes (N+1).
4.  **Resiliència**: Preparació per a pèrdues de connexió, reinicis de dispositiu i variacions d'entorn (CORS).

---

## 🚀 FASE 1: Estabilitat i Fonaments (Prioritat: Crítica)
*L'objectiu és que l'aplicació no falli i sigui configurable per a qualsevol servidor.*

1.  **Sanejament de WebSockets**: 
    *   Implementar el `cleanup` al `useEffect` de `useLivePatientLocation` per evitar memory leaks.
    *   Assegurar que `CaregiverConnectionManager` gestiona correctament les desconnexions.
2.  **Error Boundaries Quirúrgics**:
    *   Crear `MapErrorBoundary` per aïllar errors de renderitzat del mapa (Leaflet/Google Maps).
    *   Crear `ListErrorBoundary` per a l'historial de caminades.
3.  **Configuració d'Entorn (CORS/API)**:
    *   Eliminar URLs hardcoded (`localhost:3000`).
    *   Implementar `backend/.env.example` i modificar `settings.py` per llegir `FRONTEND_URL` de l'entorn.
4.  **Consolidació del Service Worker**:
    *   Eliminar versions duplicades (`sw 2.js`, `sw 3.js`, etc.).
    *   Assegurar que només existeix un `pathguard-sw.js` amb versionat automàtic.

---

## 🆘 FASE 2: Funcionalitats "Life-Saving" per a Entorn Real
*Sense aquestes funcions, el projecte no es pot provar amb pacients reals.*

1.  **Sistema SOS (Emergència)**:
    *   **Backend**: Endpoint `POST /sos` i event de WebSocket urgent.
    *   **Frontend Pacient**: Botó d'emergència discret però accessible.
    *   **Frontend Cuidador**: Alerta visual i sonora prominent en rebre SOS.
2.  **Recuperació d'Estat (Walk Recovery)**:
    *   Persistir el `walk_id` actiu a `localStorage`.
    *   En cas de reinici del mòbil del pacient, l'app ha de detectar la caminada interrompuda i oferir continuar/sincronitzar punts pendents.
3.  **Monitoratge de Bateria i Estat**:
    *   [x] Reportar el nivell de bateria del pacient en cada actualització GPS.
    *   [x] Mostrar icona d'estat de bateria al dashboard del cuidador.
    3.1 * Ho implentem així:
        3.1.1 Monitoratge de Bateria (Desacoblat)
            Tal com vam comentar, això ho farem modular:

            En lloc d'enviar-ho amb cada coordenada GPS, ho enviarem mitjançant un event WebSocket independent (device_status_update).
            Només s'enviarà si la bateria baixa un % significatiu o passen 5 minuts.
            El dashboard del cuidador mostrarà la icona i el text (ex: 🔋 45% (fa 5 min)).
            
            *Nota de Compatibilitat:*
            - ✅ **Compatible**: Android (Chrome/Edge), Desktop (Chrome/Edge/Brave).
            - ⚠️ **No disponible**: iOS (tots els navegadors), Desktop (Safari/Firefox). En aquests casos l'app mostrarà un missatge indicant que la funció no està disponible en aquell dispositiu.

---

## 🛠️ FASE 3: Qualitat de Dades i Optimització (Clean Code)
*Millorar el rendiment i la integritat de la informació.*

1.  **Validació de Coordenades (Pydantic)**:
    *   Afegir validators al backend per rebutjar coordenades GPS impossibles (fora de rang -90/90 o -180/180).
2.  **Optimització Analytics (N+1)**:
    *   Refactoritzar l'endpoint de resum d'analítiques per evitar múltiples consultes SQL en bucle. Utilitzar JOINs o consultes agregades.
3.  **Finalització Multi-Cuidador (Fase 6-7 pendent)**:
    *   Completar la UI de "Convida cuidador" (només per a l'Owner).
    *   Mostrar el nombre de "watchers" (cuidadors connectats ara) a ambdues interfícies.

---

## 📦 FASE 4: Preparació per al Desplegament "Exportable"
*Preparar l'app per sortir del laboratori.*

1.  **Exportació de Dades**:
    *   Funcionalitat per descarregar l'historial de rutes en format CSV/JSON (per a metges o anàlisi extern).
2.  **Estructura de Migracions (Alembic)**:
    *   Configurar Alembic i eliminar el `create_all()` de `main.py` per permetre actualitzacions de base de dades sense pèrdua de dades.
3.  **Suite de Tests de "Caminada Completa"**:
    *   Integrar un test que simuli tot el flux: Invitació -> Inici de caminada -> Pèrdua de connexió -> Recuperació -> SOS -> Finalització.

---

## 📂 Estat de les Tasques

> Darrera actualització: 2026-05-16 — FASE B completada (commits 78dc515, e9bdac3)

| Fase | Tasca | Estat | FASE Execució | Ref. SOLID |
|------|-------|-------|---------------|------------|
| 1.1 | WebSockets cleanup | ✅ Completat | A9 | — |
| 1.2 | Error Boundaries quirúrgics | ✅ Completat | A1 | Pas 3.1 |
| 1.3 | Configuració CORS/API | ✅ Completat | A2 | Pas 2.1-2.3 |
| 1.4 | Consolidació Service Worker | ✅ Completat | A10 | Pas 4.1 |
| 2.1 | Sistema SOS (Emergència) | ⬜ Pendent | FASE C | — |
| 2.2 | Walk Recovery | ⬜ Pendent | FASE C | — |
| 2.3 | Battery monitoring | ✅ Completat | — | — |
| 3.1 | Validació coordenades (Pydantic) | ⬜ Pendent | FASE D | — |
| 3.2 | Analytics N+1 | ⬜ Pendent | FASE D | Pas 4.5 |
| 3.3 | Multi-Cuidador UI | ⬜ Pendent | FASE D | — |
| 4.1 | Exportació dades (CSV/JSON) | ⬜ Pendent | FASE D | — |
| 4.2 | Alembic (migracions) | ⬜ Pendent | FASE D | — |
| 4.3 | Tests integració caminada completa | ⬜ Pendent | FASE D | Pas 5.1-5.2 |

Llegenda: ✅ Completat | 🔄 En procés | ⬜ Pendent

### Resum per fase

| Fase | Total | Completades | En procés | Pendents |
|------|-------|-------------|-----------|----------|
| Fase 1 | 4 | 4 | 0 | 0 |
| Fase 2 | 3 | 1 | 0 | 2 |
| Fase 3 | 3 | 0 | 0 | 3 |
| Fase 4 | 3 | 0 | 0 | 3 |

### Resum global

| Fase | Estat |
|------|-------|
| Fase 1 | ✅ Completada |
| Fase 2 | 🔄 En curs (1/3 completada - Battery) |
| Fase 3 | ⬜ Pendent |
| Fase 4 | ⬜ Pendent |

### Dependències entre fases

```
FASE A (estabilitat + neteja SOLID) ✅
  ↓
FASE B (refactor arquitectural: ws_manager, CaregiverDashboard, broadcast) ✅
  ↓
FASE C (noves funcionalitats: SOS, Walk Recovery)
  ↓
FASE D (qualitat: validació, analytics, tests, Alembic, export)
```

---

## Registre de canvis

### FASE A — Commit b4180e1 (2026-05-16) — MERGED to develop

**BETA_V2 Fase 1 completada:**
- 1.1 WebSockets cleanup: console.log a console.debug, null checks
- 1.2 Error Boundaries: creat AppErrorBoundary compartit, refactorats MapErrorBoundary i WalkHistoryList/ErrorBoundary
- 1.3 CORS/API: centralitzat config.ts amb STORAGE_KEYS complet, WS_BASE_URL, GPS constants; eliminades URLs hardcoded
- 1.4 Service Worker: extret inline script a swRegistration.tsx

**SOLID passos completats:** 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.5, 4.6

**Bug fixes post-merge:**
- Corregit WS_BASE_URL sense path /api/v1/ws/
- Corregit doble sufixe +00:00Z en timestamps WS (6 ocurr ncies)
- Corregit deque no JSON-serializable a WalkStateCache.get()

### FASE B — Commits 78dc515 + e9bdac3 (2026-05-16) — MERGED to develop

**SOLID Pas 1.1 — ws_manager.py descompost:**
- Creat `app/api/websocket/connection_manager.py`: connexions, rooms, broadcast
- Creat `app/api/websocket/presence_tracker.py`: estat online/offline pacient
- Creat `app/api/websocket/snapshot_service.py`: late-join snapshot construction
- Creat `app/api/websocket/ws_auth.py`: JWT + device token authentication
- Creat `app/api/websocket/event_publisher.py`: pub/sub event bus
- Creat `app/api/websocket/broadcast_handlers.py`: subscriptors d'events
- `walk_service.py` i `location_service.py` ara usen `event_publisher` (broadcast separat - Pas 1.3)

**SOLID Pas 1.2 — CaregiverDashboard descompost:**
- Creat `CaregiverHeader.tsx`: logout, group name, invite button
- Creat `PatientStatusCard.tsx`: connectivity, time-ago, battery status
- Creat `CaregiverAnalytics.tsx`: analytics barres, freqÜència, hores
- Creat `CaregiverWalkHistory.tsx`: historial + ErrorBoundary wrapper
- Creat `CaregiverDashboardLayout.tsx`: orquestrador que composa els anteriors

**SOLID Pas 1.3 — Broadcast separat (inclòs en 78dc515):**
- EventPublisher implementat i usat per walk_service i location_service
- Desacoblament total entre serveis i WebSocket manager

**Nota:** FASE B inclou els passos 1.1, 1.2 i 1.3 del pla SOLID (descomposició SRP)
