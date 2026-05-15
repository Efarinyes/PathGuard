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
- [ ] Fase 1: Estabilitat (WebSocket, Boundaries, CORS, SW)
- [ ] Fase 2: SOS, Recovery, Battery
- [ ] Fase 3: Validation, Analytics, Multi-Caregiver UI
- [ ] Fase 4: Export, Alembic, Integrated Tests
