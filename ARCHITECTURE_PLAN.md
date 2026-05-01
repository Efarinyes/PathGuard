# Architectural Review & SOLID Action Plan: PathGuard

This document outlines a detailed, step-by-step action plan to refactor the PathGuard PWA frontend, ensuring adherence to SOLID principles and minimizing accumulated technical debt.

## Executive Summary

PathGuard has successfully achieved its core MVP features: persistent offline tracking, real-time caregiver synchronization, and PWA installation. However, rapid iteration has introduced technical debt, primarily in the form of **Single Responsibility Principle (SRP)** violations. Complex business logic, state management, and side effects (like DOM event listeners and network polling) are heavily intertwined within single files.

This plan details a phased approach to decouple these responsibilities, making the application more testable, maintainable, and scalable.

---

## Phase 1: Decoupling the Data Layer (Services & State)

Currently, services like `locationService.ts` mix business logic (batching), infrastructure logic (IndexedDB, `fetch`), and DOM side effects.

### Step 1.1: Extract DOM Side Effects from Services
- **Issue**: `locationService.ts` attaches `window.addEventListener('online')` and `document.addEventListener('visibilitychange')` at the module level. This is an anti-pattern in React/Next.js, complicating SSR and testing.
- **Action**: 
  - Create a new React hook `useOfflineRecovery.ts`.
  - Move all DOM event listeners (`online`, `focus`, `visibilitychange`) into this hook.
  - The hook will inject or call `locationService.syncQueuedPoints()` when triggered.
  - Mount this hook globally (e.g., in `AppStateProvider` or a dedicated `RecoveryProvider`).

### Step 1.2: Separate Batching Logic from Network Transport (SRP)
- **Issue**: `locationService.ts` handles the in-memory array (`batchBuffer`), timer logic (`batchTimer`), and the actual HTTP `fetch` implementation.
- **Action**:
  - Extract the HTTP logic into a dedicated `apiClient.ts` or `gpsTransportService.ts`.
  - Keep `locationService.ts` focused *only* on the adaptive batching algorithm and coordinating between the `offlineSyncService` and the transport service.

---

## Phase 2: Refactoring Complex Hooks (State & WebSockets)

`useLivePatientLocation.ts` is currently a monolithic hook ("God Hook") that violates SRP and the Open/Closed Principle (OCP).

### Step 2.1: Abstract WebSocket Message Handling
- **Issue**: `useLivePatientLocation.ts` contains hardcoded `if/else` statements for processing different WebSocket message types (`snapshot`, `walk_started`, `location`), violating OCP. It also manually manages deduplication (`processedEvents`) and chronological sorting.
- **Action**:
  - Create a pure utility function or class (`WalkEventProcessor.ts`) responsible solely for merging new events into a history array, applying deduplication, and sorting.
  - Use a strategy pattern or a reducer (`useReducer`) inside the hook to handle different WS message types cleanly, allowing new message types to be added without modifying the core hook structure.

### Step 2.2: Extract REST Hydration Logic
- **Issue**: `useLivePatientLocation.ts` performs the initial `fetch` for the active walk snapshot.
- **Action**:
  - Move the REST API call to `walkService.ts` (e.g., `walkService.getActiveWalk()`).
  - The hook should only call this service method, decoupling the hook from raw `fetch` mechanics.

---

## Phase 3: Cleaning Up the Presentation Layer (Components)

UI components are currently burdened with data fetching and interval management.

### Step 3.1: Extract Data Fetching from `CaregiverDashboard`
- **Issue**: `CaregiverDashboard/index.tsx` manually uses `useEffect` and `setInterval` to fetch `walks` and `analytics`, violating SRP.
- **Action**:
  - Create a custom hook `useCaregiverAnalytics.ts`.
  - Move the fetching logic, `setInterval` polling, and associated state (`walks`, `analytics`, `isLoading`) into this hook.
  - `CaregiverDashboard` should simply consume this hook: `const { walks, analytics } = useCaregiverAnalytics(userToken, isActive);`.

### Step 3.2: Centralize Routing Logic
- **Issue**: `page.tsx` and `caregiver/page.tsx` duplicate logic to enforce role-based redirection based on `deviceToken` and `userToken`.
- **Action**:
  - Implement a centralized Higher-Order Component (HOC) or a Next.js Layout/Wrapper (e.g., `<RoleGuard>`).
  - This wrapper should handle the `isHydrated` checks and automatic redirects, removing boilerplate from the individual page components and strictly enforcing routing rules in one place.

---

## Phase 4: Strengthening the PWA Architecture

### Step 4.1: Abstract PWA Install Logic
- **Issue**: `PWAInstallPrompt.tsx` contains both the UI presentation and the complex browser detection/event listener logic (`beforeinstallprompt`, iOS Safari detection).
- **Action**:
  - Create a `usePWAInstall.ts` hook to encapsulate the browser detection and prompt mechanics.
  - The `PWAInstallPrompt` component should only handle the visual rendering of the banner/tooltip based on the state provided by the hook.

---

> [!TIP]
> **Implementation Strategy**
> Execute these phases sequentially. Phase 1 and 2 target the most critical technical debt (data integrity and sync race conditions). Phase 3 and 4 improve maintainability and developer experience without altering core tracking stability. By ensuring tests pass after each discrete step, the risk of regression is minimized.
