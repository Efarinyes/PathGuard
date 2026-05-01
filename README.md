# 🛡️ PathGuard - Real-Time GPS Tracking System

PathGuard is a specialized real-time GPS tracking application designed for patient safety. It allows caregivers to monitor patient walks in real-time with sub-second latency using WebSockets and a high-performance FastAPI/Next.js stack.

## ✨ Key Features

- **Real-time Tracking**: Live GPS updates with sub-second latency via WebSockets.
- **Dual Interface**: 
  - **Patient Mode**: Minimalist, high-contrast PWA optimized for seniors.
  - **Caregiver Dashboard**: Interactive map with walk history and analytics.
- **PWA Excellence**: Fully installable on iOS (Safari), Android (Chrome), and Desktop.
- **Offline Resilience**: Intelligent location batching and local synchronization for poor network areas.
- **Discreet Privacy**: Designed to be unobtrusive and respect patient dignity.

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **Micromamba/Conda** (Recommended for backend environment management)

### 1. Backend Setup (FastAPI)

The backend manages authentication, GPS data ingestion, and real-time broadcasting.

```bash
cd backend

# Create and activate environment
micromamba env create -f environment.yml
micromamba activate tracker-env

# Initialize the database (SQLite)
python init_db.py

# Run the server
python -m uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. 
Documentation: `http://localhost:8000/docs`.

### 2. Frontend Setup (Next.js)

The frontend features dual interfaces for Patients (minimalist PWA) and Caregivers (real-time mapping dashboard).

```bash
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### 3. Running E2E Tests (Playwright)

To verify the full "Golden Path" (Registration -> Real-time Tracking -> Termination):

```bash
cd frontend
npx playwright test
```

## 🏗️ Architecture

- **Frontend**: Next.js 15 (App Router), Tailwind CSS v4, Lucide Icons.
- **Backend**: FastAPI, SQLAlchemy (SQLite), Pydantic v2.
- **PWA**: `@ducanh2912/next-pwa` for robust service worker management and offline caching.
- **Real-time**: WebSockets for live location broadcasting.
- **State Management**: Custom React Hooks with LocalStorage persistence and offline sync buffers.

## 📱 Mobile & PWA

PathGuard is built as a First-Class Progressive Web App:
- **Standalone Mode**: Behaves like a native app on mobile home screens.
- **Install Support**: Custom install prompts for Android/Chrome.
- **Safe Areas**: Optimized for modern devices with notches and gesture navigation.
- **Performance**: Optimized for low-power mobile devices.

## 🔐 Core Rules

1. **Patient Isolation**: Only one active walk is allowed per patient.
2. **Dual-Auth**: Supports both JWT (Caregivers) and Device Tokens (Patients).
3. **Data Integrity**: GPS points are timestamped in UTC and strictly validated for sequence consistency.

## 🏷️ Status

Current Status: **Beta Ready (Alpha Final)**
*PWA features are production-ready for real-world beta testing.*

---
*Developed for PathGuard Patient Safety Project.*

