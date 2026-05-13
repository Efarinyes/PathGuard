# PathGuard Project Audit

## 1. Executive Summary

Current real project state

PathGuard is a family safety PWA designed for monitoring vulnerable individuals during outdoor walks. The project implements a Next.js frontend with FastAPI backend, featuring offline-first capabilities, real-time location tracking via WebSockets, and PWA installability. The architecture separates concerns appropriately for its intended scale (1 patient, N caregivers). The codebase shows good attention to production concerns like offline recovery, multi-tab synchronization, and proper state persistence. However, several critical risks exist that could impede Beta readiness, particularly around WebSocket connection management, error boundaries, and deployment complexity.

## 2. Architectural Strengths

What is already well designed

- **Clean separation of concerns**: Frontend uses React hooks effectively for state management (`useAppState`, `useLivePatientLocation`), service layer for API calls, and components focused on UI rendering
- **Robust offline strategy**: Service worker with Workbox, localStorage synchronization via `useAppState` and `useOfflineRecovery`, and offline-capable patient behavior
- **Real-time architecture**: WebSocket connections with heartbeat detection and automatic reconnection logic in `useWebSocket` hook
- **Multi-tab/window sync**: Storage event listeners in `useAppState` ensure state consistency across tabs
- **Proper hydration handling**: AppStateProvider correctly handles SSR hydration with localStorage rehydration
- **Role-based routing**: RoleGuard component prevents unauthorized access to patient/caregiver pages
- **Domain modeling**: Clean SQLAlchemy models with proper relationships (Patient→Walk, Group isolation)

## 3. Critical Risks

Real issues that could break Beta readiness

Ordered by severity

### High Severity

1. **WebSocket connection leaks** (Critical)
   - In `hooks/useWebSocket.ts`, connections are created but not properly cleaned up on component unmount in all code paths
   - `useLivePatientLocation` hook creates watchers but cleanup relies solely on the `enabled` flag, which may not trigger reliably
   - Risk: Memory leaks, stale connections consuming server resources, potential WebSocket server overload

2. **Inconsistent error boundaries** (Critical)
   - Only `PWAErrorBoundary` wraps the app in layout.tsx, but individual components like `CaregiverMap` and `WalkHistoryList` lack error boundaries
   - Risk: A single component error could crash the entire PWA interface, leaving caregivers without visibility

3. **Hardcoded localhost origins** (High)
   - Backend `ALLOWED_ORIGINS` in main.py contains only localhost addresses with comment to add production URL
   - Risk: Deployment failure if not manually updated; no mechanism for environment-specific configuration

4. **Service worker versioning issues** (High)
   - Multiple SW files exist (`pathguard-sw.js`, `pathguard-sw 2.js`, etc.) suggesting manual updates without proper versioning
   - Risk: stale caches, failed updates, unpredictable offline behavior

### Medium Severity

5. **Database initialization on every startup** (Medium)
   - Backend creates tables on each app start via `Base.metadata.create_all(bind=engine)`
   - Risk: In production with multiple replicas, could cause race conditions; not suitable for migration management

6. **Limited input validation on location endpoints** (Medium)
   - Location POST endpoint accepts raw coordinates without range validation (-90 to 90, -180 to 180)
   - Risk: Invalid GPS data could corrupt walk history or cause map rendering issues

7. **Analytics endpoint N+1 query risk** (Medium)
   - `useCaregiverAnalytics` makes multiple sequential calls; backend analytics may perform multiple queries
   - Risk: Performance degradation as walk history grows

## 4. SOLID / Clean Code Findings

Concrete violations and risks

Only relevant findings

- **SRP Violation**: `CaregiverDashboard` component handles too many responsibilities (data fetching, UI state, notifications, analytics, history) - should be split into smaller components
- **OCP Concern**: WebSocket reconnection logic in `useWebSocket.ts` is hardcoded; difficult to modify retry strategies without modifying hook
- **LSP Compliance**: Good - components properly extend abstractions via props
- **ISP Violation**: `useAppState` provides both user and patient session methods; consider separating concerns
- **DIP Violation**: Direct imports of concrete services (`walkService`) in components; consider dependency injection or context

Code quality is generally good with proper TypeScript usage, consistent formatting, and meaningful variable names. However, some functions exceed recommended length (e.g., `CaregiverDashboard` at 320 lines).

## 5. Product Logic Gaps

Missing functional behavior or weak product decisions

Not UI issues

Only real product risks

1. **No emergency escalation path** (Critical Gap)
   - Product assumes passive monitoring but lacks any mechanism for patient to signal distress or for caregivers to initiate emergency protocols
   - While not a medical device, basic SOS functionality aligns with family safety expectations

2. **Walk state recovery incomplete** (High Gap)
   - If patient device loses power/battery during walk, there's no mechanism to resume walk after reboot
   - Current `useOfflineRecovery` handles connection loss but not full device shutdown

3. **Caregiver lacks patient context** (Medium Gap)
   - No way for caregiver to see patient's last known battery level or device status beyond connectivity
   - Important for assessing reliability of monitoring

4. **No data export/gdpr compliance** (Medium Gap)
   - Families may want to download walk history or delete account/data; no endpoints exist
   - While not GDPR-regulated per se, basic data control builds trust

5. **Walk sharing limited to owner** (Low Gap)
   - Only group owner can invite caregivers; in family scenarios, multiple members may need to manage access

## 6. Priority Improvement Roadmap

Ordered list:

### Critical now
1. Fix WebSocket connection leaks with proper cleanup in all hooks
2. Add individual error boundaries to high-risk components (map, history)
3. Implement environment-based CORS configuration (remove hardcoded localhost)
4. Consolidate service worker files with proper versioning strategy

### Before Beta
1. Add basic SOS/emergency signaling capability (patient-initiated)
2. Improve walk state persistence to survive device reboots
3. Add device battery/status reporting to patient telemetry
4. Implement basic data export functionality for walk history

### Can wait for v2
1. Refactor `CaregiverDashboard` into smaller components following SRP
2. Implement proper database migration system (Alembic)
3. Add GDPR-compliant data deletion endpoints
4. Allow multiple caregivers to manage group invitations
5. Enhance analytics with caching to prevent N+1 queries

## 7. Safe Recovery Points

Recommended commits/tags before risky refactors

Before making architectural changes:
1. Tag current state as `audit-baseline-2026-05-11`
2. Create backup branch `pre-websocket-fix` before modifying WebSocket hooks
3. Tag `pre-service-worker-consolidation` before SW changes
4. Maintain `pre-error-boundary-add` before adding component error boundaries

## 8. What Should NOT Be Changed

Important stable areas that should remain untouched

- Core authentication flow (JWT + device tokens) - working correctly
- Offline-first localStorage synchronization strategy - appropriate for scale
- Role-based routing structure (patient/caregiver/register) - clean separation
- WebSocket heartbeat mechanism - effective for connectivity detection
- PWA manifest and install flow - follows best practices

## 9. Final Verdict

Choose one:

* Alpha-safe
* Beta-ready with fixes
* Unsafe for production

And explain why.

**Beta-ready with fixes**

The project demonstrates solid architectural foundations appropriate for its intended scale and use case. The offline-first approach, real-time capabilities, and PWA implementation are well-executed. However, the critical WebSocket connection leaks and error boundary gaps pose significant risks to production stability that must be addressed before Beta release. With the proposed fixes implemented, PathGuard would be suitable for real-world family testing as a Beta product. The core value proposition (discreet walking safety monitoring) is technically sound and ready for validation with the noted improvements.