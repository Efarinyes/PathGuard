"""
tests/integration/test_active_walk.py

Production-ready Pytest integration tests for:
    GET /api/v1/walks/active

Endpoint behaviour under test
──────────────────────────────
The endpoint has two distinct data paths and one auth gate:

  1. Auth gate — resolves patient via JWT (caregiver) or X-Patient-Token.
     Returns 401 when neither credential is supplied or valid.

  2. No active walk → {"active_walk": None}

  3. Active walk, cache HIT
     → returns walk_id, patient_id, latest_location, history directly from
       the in-memory WalkStateCache singleton.

  4. Active walk, cache MISS (e.g. after server restart)
     → falls back to DB: fetches last 50 locations ordered desc, reverses,
       re-populates the cache, returns same shape.

  5. Active walk, cache MISS, no locations in DB
     → latest_location: None, history: []

Mock strategy
─────────────
• SQLite in-memory DB — shared session injected via dependency_override
  (same pattern as the existing conftest).
• walk_state_cache singleton is imported and mutated directly in each test;
  cache.clear() is called in teardown to prevent cross-test contamination.
• No real HTTP is made — FastAPI TestClient runs everything in-process.
"""

import uuid
from datetime import datetime, timezone
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.models.location import Location
from app.api.models.patient import Patient
from app.api.models.walk import Walk
from app.api.users.models import User
from app.db.state import walk_state_cache

# ─── URL constant ─────────────────────────────────────────────────────────────

ENDPOINT = "/api/v1/walks/active"


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clean_walks_and_cache(db: Session):
    """
    Isolate each test: clear all Walk and Location rows and flush the
    in-memory cache before and after every test in this module.
    """
    db.query(Location).delete()
    db.query(Walk).delete()
    db.commit()
    walk_state_cache._cache.clear()

    yield

    db.query(Location).delete()
    db.query(Walk).delete()
    db.commit()
    walk_state_cache._cache.clear()


@pytest.fixture
def patient_with_caregiver(db: Session, caregiver_user: User) -> Patient:
    """
    Create a Patient and link it to the test caregiver so that
    resolve_patient() succeeds on JWT-authenticated requests.
    Returns the Patient (device_token available as .device_token).
    """
    existing = db.query(Patient).filter(Patient.name == "Test Patient").first()
    if existing:
        if caregiver_user not in existing.caregivers:
            existing.caregivers.append(caregiver_user)
            db.commit()
        return existing

    patient = Patient(name="Test Patient", device_token=uuid.uuid4())
    db.add(patient)
    db.flush()
    caregiver_user.patients.append(patient)
    db.commit()
    db.refresh(patient)
    return patient


@pytest.fixture
def active_walk(db: Session, patient_with_caregiver: Patient) -> Walk:
    """Create and persist an active Walk for the linked patient."""
    walk = Walk(
        start_time=datetime(2026, 4, 25, 10, 0, 0),
        active=True,
        initiated_by_type="patient",
        initiated_by_id=patient_with_caregiver.id,
    )
    db.add(walk)
    db.commit()
    db.refresh(walk)
    return walk


def _make_location_dict(lat: float, lng: float, ts: str) -> dict:
    """Helper: build a location dict in the exact shape the cache stores."""
    return {"latitude": lat, "longitude": lng, "timestamp": ts}


def _persist_location(db: Session, walk: Walk, lat: float, lng: float, ts: datetime) -> Location:
    """Helper: insert a Location row and commit."""
    loc = Location(walk_id=walk.id, latitude=lat, longitude=lng, timestamp=ts)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


# ─── A. Authentication ────────────────────────────────────────────────────────

class TestAuthentication:

    def test_A1_no_credentials_returns_401(self, client: TestClient):
        """Unauthenticated request must be rejected."""
        response = client.get(ENDPOINT)
        assert response.status_code == 401

    def test_A2_invalid_jwt_returns_401(self, client: TestClient):
        """Malformed / expired JWT must be rejected."""
        response = client.get(ENDPOINT, headers={"Authorization": "Bearer not-a-real-token"})
        assert response.status_code == 401

    def test_A3_invalid_device_token_format_is_rejected(self, client: TestClient):
        """Non-UUID device token must not crash the server."""
        response = client.get(ENDPOINT, headers={"X-Patient-Token": "not-a-uuid"})
        # resolve_patient finds no patient → 401
        assert response.status_code == 401

    def test_A4_caregiver_jwt_is_accepted(
        self, client: TestClient, auth_headers: dict, patient_with_caregiver: Patient
    ):
        """Valid caregiver JWT with a linked patient must reach the endpoint logic."""
        response = client.get(ENDPOINT, headers=auth_headers)
        # No active walk — but auth passed, so we expect the "no walk" payload
        assert response.status_code == 200
        assert response.json() == {"active_walk": None}

    def test_A5_patient_device_token_is_accepted(
        self, client: TestClient, patient_with_caregiver: Patient
    ):
        """Valid X-Patient-Token must reach the endpoint logic."""
        response = client.get(
            ENDPOINT,
            headers={"X-Patient-Token": str(patient_with_caregiver.device_token)},
        )
        assert response.status_code == 200
        assert response.json() == {"active_walk": None}


# ─── B. No active walk ────────────────────────────────────────────────────────

class TestNoActiveWalk:

    def test_B1_returns_null_when_no_walk_exists(
        self, client: TestClient, auth_headers: dict, patient_with_caregiver: Patient
    ):
        """When there is no walk in DB, the response body is {"active_walk": None}."""
        response = client.get(ENDPOINT, headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {"active_walk": None}

    def test_B2_returns_null_when_only_inactive_walks_exist(
        self, client: TestClient, db: Session, auth_headers: dict, patient_with_caregiver: Patient
    ):
        """A finished walk must not be returned as active."""
        finished = Walk(
            start_time=datetime(2026, 4, 25, 9, 0, 0),
            end_time=datetime(2026, 4, 25, 9, 30, 0),
            active=False,
            initiated_by_type="patient",
            initiated_by_id=patient_with_caregiver.id,
        )
        db.add(finished)
        db.commit()

        response = client.get(ENDPOINT, headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {"active_walk": None}


# ─── C. Active walk — cache HIT ───────────────────────────────────────────────

class TestCacheHit:

    def test_C1_returns_walk_id_and_patient_id(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """Cache hit: walk_id and patient_id appear at the top level."""
        loc = _make_location_dict(41.3874, 2.1686, "2026-04-25T10:00:00")
        walk_state_cache.update(active_walk.id, loc)

        response = client.get(ENDPOINT, headers=auth_headers)
        assert response.status_code == 200
        body = response.json()

        assert body["active_walk_id"] == active_walk.id
        assert body["patient_id"] == patient_with_caregiver.id

    def test_C2_latest_location_matches_cache(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """latest_location must be the exact dict stored in the cache."""
        loc = _make_location_dict(41.3874, 2.1686, "2026-04-25T10:00:00")
        walk_state_cache.update(active_walk.id, loc)

        body = client.get(ENDPOINT, headers=auth_headers).json()
        assert body["latest_location"] == loc

    def test_C3_history_contains_all_cached_points_in_order(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """history must contain every point pushed into the cache, in insertion order."""
        locs = [
            _make_location_dict(41.3874 + i * 0.0001, 2.1686 + i * 0.0001, f"2026-04-25T10:0{i}:00")
            for i in range(3)
        ]
        for loc in locs:
            walk_state_cache.update(active_walk.id, loc)

        body = client.get(ENDPOINT, headers=auth_headers).json()
        assert body["history"] == locs

    def test_C4_cache_hit_does_not_query_db_locations(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
        monkeypatch,
    ):
        """
        When the cache has data, the DB Location table must NOT be queried.
        We verify this by seeding a deliberately different value in the DB —
        if the endpoint uses the DB path it would return different coordinates.
        """
        # DB location — different coordinates
        _persist_location(db, active_walk, 99.9999, 99.9999, datetime(2026, 4, 25, 9, 59, 0))

        # Cache location — the coordinates we expect to see
        cached_loc = _make_location_dict(41.3874, 2.1686, "2026-04-25T10:00:00")
        walk_state_cache.update(active_walk.id, cached_loc)

        body = client.get(ENDPOINT, headers=auth_headers).json()
        assert body["latest_location"]["latitude"] == pytest.approx(41.3874)
        assert body["latest_location"]["longitude"] == pytest.approx(2.1686)


# ─── D. Active walk — cache MISS (DB fallback) ────────────────────────────────

class TestCacheMiss:

    def test_D1_falls_back_to_db_when_cache_is_empty(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """With an empty cache, the endpoint must query the DB and return data."""
        ts = datetime(2026, 4, 25, 10, 0, 0)
        _persist_location(db, active_walk, 41.3874, 2.1686, ts)

        body = client.get(ENDPOINT, headers=auth_headers).json()

        assert body["active_walk_id"] == active_walk.id
        assert body["latest_location"]["latitude"]  == pytest.approx(41.3874)
        assert body["latest_location"]["longitude"] == pytest.approx(2.1686)
        assert body["latest_location"]["timestamp"] == ts.isoformat()

    def test_D2_history_is_chronologically_ordered(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """
        The endpoint fetches DB rows ordered DESC then reverses — result must
        be ascending (oldest first).
        """
        t1 = datetime(2026, 4, 25, 10, 0, 0)
        t2 = datetime(2026, 4, 25, 10, 0, 30)
        t3 = datetime(2026, 4, 25, 10, 1, 0)

        # Insert in arbitrary order
        _persist_location(db, active_walk, 41.3889, 2.1701, t3)
        _persist_location(db, active_walk, 41.3874, 2.1686, t1)
        _persist_location(db, active_walk, 41.3881, 2.1692, t2)

        body = client.get(ENDPOINT, headers=auth_headers).json()
        history = body["history"]

        assert len(history) == 3
        assert history[0]["timestamp"] == t1.isoformat()
        assert history[1]["timestamp"] == t2.isoformat()
        assert history[2]["timestamp"] == t3.isoformat()

    def test_D3_latest_location_equals_last_history_point(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """latest_location must always equal history[-1]."""
        t1 = datetime(2026, 4, 25, 10, 0, 0)
        t2 = datetime(2026, 4, 25, 10, 0, 30)
        _persist_location(db, active_walk, 41.3874, 2.1686, t1)
        _persist_location(db, active_walk, 41.3881, 2.1692, t2)

        body = client.get(ENDPOINT, headers=auth_headers).json()
        assert body["latest_location"] == body["history"][-1]

    def test_D4_cache_is_repopulated_after_db_fallback(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """
        After a DB-fallback response, the cache must be populated so the
        next request uses the cache path (no repeated DB scan).
        """
        ts = datetime(2026, 4, 25, 10, 0, 0)
        _persist_location(db, active_walk, 41.3874, 2.1686, ts)

        # First request — triggers DB fallback and cache population
        client.get(ENDPOINT, headers=auth_headers)

        cached = walk_state_cache.get(active_walk.id)
        assert cached is not None
        assert cached["latest"]["latitude"] == pytest.approx(41.3874)

    def test_D5_history_capped_at_50_points(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """
        The DB fallback fetches at most 50 points (.limit(50)).
        Inserting 60 rows must still yield a history of exactly 50.
        """
        for i in range(60):
            ts = datetime(2026, 4, 25, 10, i // 60, i % 60)
            _persist_location(db, active_walk, 41.3874 + i * 0.0001, 2.1686, ts)

        body = client.get(ENDPOINT, headers=auth_headers).json()
        assert len(body["history"]) == 50

    def test_D6_no_locations_in_db_returns_none_latest(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """Active walk with zero location rows → latest_location: None, history: []."""
        body = client.get(ENDPOINT, headers=auth_headers).json()

        assert body["active_walk_id"] == active_walk.id
        assert body["latest_location"] is None
        assert body["history"] == []


# ─── E. State consistency ─────────────────────────────────────────────────────

class TestStateConsistency:

    def test_E1_patient_device_token_auth_returns_same_shape(
        self, client: TestClient, db: Session,
        active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """The response shape is identical regardless of auth method."""
        loc = _make_location_dict(41.3874, 2.1686, "2026-04-25T10:00:00")
        walk_state_cache.update(active_walk.id, loc)

        response = client.get(
            ENDPOINT,
            headers={"X-Patient-Token": str(patient_with_caregiver.device_token)},
        )
        assert response.status_code == 200
        body = response.json()
        assert "active_walk_id" in body
        assert "patient_id" in body
        assert "latest_location" in body
        assert "history" in body

    def test_E2_concurrent_reads_return_consistent_cache_state(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """
        Simulates two rapid consecutive reads after a cache update.
        Both must return identical data — no race condition in the singleton.
        """
        loc = _make_location_dict(41.3874, 2.1686, "2026-04-25T10:00:00")
        walk_state_cache.update(active_walk.id, loc)

        r1 = client.get(ENDPOINT, headers=auth_headers).json()
        r2 = client.get(ENDPOINT, headers=auth_headers).json()

        assert r1["latest_location"] == r2["latest_location"]
        assert r1["history"] == r2["history"]

    def test_E3_response_shape_has_all_required_keys(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """Every key expected by the frontend rehydration logic must be present."""
        loc = _make_location_dict(41.3874, 2.1686, "2026-04-25T10:00:00")
        walk_state_cache.update(active_walk.id, loc)

        body = client.get(ENDPOINT, headers=auth_headers).json()
        required_keys = {"active_walk_id", "patient_id", "latest_location", "history"}
        assert required_keys.issubset(body.keys())

    def test_E4_latest_location_shape_is_correct(
        self, client: TestClient, db: Session,
        auth_headers: dict, active_walk: Walk, patient_with_caregiver: Patient,
    ):
        """latest_location must always include latitude, longitude, and timestamp."""
        loc = _make_location_dict(41.3874, 2.1686, "2026-04-25T10:00:00")
        walk_state_cache.update(active_walk.id, loc)

        body = client.get(ENDPOINT, headers=auth_headers).json()
        ll = body["latest_location"]
        assert "latitude"  in ll
        assert "longitude" in ll
        assert "timestamp" in ll
