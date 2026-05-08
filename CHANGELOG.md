# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0-beta.1] - 2026-05-08

### Added
- **Phase D: PWA Hardening** (all tasks completed)
  - D.1: Service worker registration conflict fix with configurable localhost via `.env`
  - D.2: Offline fallback page (`/offline`)
  - D.3: Sync status API endpoint (`GET /api/v1/locations/sync/status`)
  - D.4: Cache-Control headers middleware
  - D.5: PWA ErrorBoundary component for graceful error handling
- **Phase C: Architecture** (service layer extraction)
  - C.1: Extract service layer from routers (`backend/app/services/`)
  - C.2: Documented WalkStateCache limitations
- **Feature: is_recovered column**
  - Backend support for tracking offline-synced locations
  - Frontend dashed amber line rendering for recovered segments

### Changed
- **Backend**: Replaced deprecated `datetime.utcnow()` with `datetime.now(timezone.utc)`
- **Backend**: Consolidated duplicate security code (jwt, auth, password)
- **Backend**: Added Cache-Control middleware for all routes
- **Backend**: Improved exception handling in auth endpoints

### Fixed
- **Phase B: Technical Debt** (12 tasks completed)
  - Eliminated `any` types in frontend (72 instances)
  - Removed duplicate `get_db()` and `/login` endpoints
  - Standardized frontend import paths
  - Centralized frontend configuration

### Removed
- Dead code files (`backend/app/api/ws.py`, `auth/auth_router.py`)

### Dependencies
- Updated Next.js to 16.2.4
- Updated React to 19.2.4
- Updated PWA plugin (@ducanh2912/next-pwa v10.2.9)

---

## [1.0.0] - 2025-XX-XX

### Added
- Initial release
- Patient location tracking
- Caregiver dashboard with real-time map
- WebSocket real-time updates
- PWA support (installable)

---

[2.0.0-beta.1]: https://github.com/Efarinyes/PathGuard/compare/v1.0.0...v2.0.0-beta.1
[1.0.0]: https://github.com/Efarinyes/PathGuard/releases/v1.0.0