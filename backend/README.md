# 🛡️ PathGuard - Backend API

This is the **FastAPI** backend for PathGuard, the core engine responsible for GPS data ingestion, real-time WebSocket broadcasting, and secure session management.

## 📋 Requirements

- **Python**: `3.11.*` (Strictly required for compatibility with the project's dependency tree).

## 🚀 Environment Setup

Choose the method that best fits your workflow:

### Option 1: Micromamba / Conda (Recommended)
This uses the provided `environment.yml` to ensure exact dependency matching.
```bash
micromamba env create -f environment.yml
micromamba activate tracker-env
```

### Option 2: Python `venv`
If you prefer standard virtual environments, ensure you have Python 3.11 installed:
```bash
# Create the environment
python3.11 -m venv .venv

# Activate it
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate  # Windows

# Install dependencies
pip install --upgrade pip
pip install fastapi "pydantic[email]" pydantic-settings sqlalchemy uvicorn "python-jose[cryptography]" "passlib[bcrypt]" bcrypt==3.2.0 psycopg2-binary httpx pytest pytest-asyncio
```

## 🛠️ Getting Started

1. **Initialize the Database**:
   PathGuard uses SQLite for local development. Initialize it by running:
   ```bash
   python init_db.py
   ```

2. **Launch the Server**:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```
   - **Local Endpoint**: `http://localhost:8000`
   - **Interactive API Docs**: `http://localhost:8000/docs` (Swagger UI)

## 📁 Project Structure

- `app/api/`: Endpoint definitions (REST & WebSockets).
- `app/core/`: Security, configuration, and global constants.
- `app/db/`: Database models and SQLAlchemy sessions.
- `app/services/`: Business logic and background processing.
- `tests/`: Comprehensive test suite using `pytest`.

## 🧪 Testing
We use `pytest` for unit and integration testing. To run all tests:
```bash
pytest
```

---
*For frontend setup and overall project overview, see the [Root README](../README.md).*
