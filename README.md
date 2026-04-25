# 🛡️ PathGuard - Real-Time GPS Tracking System

PathGuard is a specialized real-time GPS tracking application designed for patient safety. It allows caregivers to monitor patient walks in real-time with sub-second latency using WebSockets and a high-performance FastAPI/Next.js stack.

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

- **Frontend**: Next.js 14 (App Router), Tailwind CSS v4, Lucide Icons.
- **Backend**: FastAPI, SQLAlchemy (SQLite), Pydantic v2.
- **Real-time**: WebSockets for live location broadcasting.
- **State Management**: Custom React Hooks with LocalStorage persistence.

## 🔐 Core Rules

1. **Patient Isolation**: Only one active walk is allowed per patient.
2. **Dual-Auth**: Supports both JWT (Caregivers) and Device Tokens (Patients).
3. **Data Integrity**: GPS points are timestamped in UTC and strictly validated for sequence consistency.

## 🏷️ Versioning

Current Version: **v1.0.0 (Alpha)**
Follows semantic versioning and Git-tagged releases.

---
*Developed for PathGuard Patient Safety Project.*
