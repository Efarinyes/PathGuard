"""
tests/integration/test_walk_lifecycle.py

Production-ready Pytest integration tests for:
    POST /api/v1/walks/start
    POST /api/v1/walks/stop

Implementation notes (from source — critical for test accuracy)
────────────────────────────────────────────────────────────────
• /start returns a bare integer (the new walk_id) — NOT a JSON object.
• /stop  returns { id, start_time, end_time, duration_seconds, location_count }
• Both endpoints check for ANY globally active walk (Walk.active == True),
  not per-patient. Therefore two patients cannot have simultaneous walks —
  the second start attempt is rejected with 400.
• walk_state_cache.clear(walk_id) is called BEFORE db.commit() on stop.
• WebSocket manager has zero active_connections in tests → broadcast is a no-op.

Test groups
───────────
  A  Start — success path
  B  Double-start prevention (global active-walk constraint)
  C  Stop — success path and response shape
  D  Stop clears cache
  E  Stop without active walk → 404
  F  Auth validation (start + stop)
  G  Full integration: start → locations → stop → /walks/active
  H  Edge cases
"""

import pytest
from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.models.location import Location
from app.api.models.patient import Patient
from app.api.models.walk import Walk
from app.api.users.models import User
from app.db.state import walk_state_cache

# ─── URL constants ────────────────────────────────────────────────────────────

START    = "/api/v1/walks/start"
STOP     = "/api/v1/walks/stop"
ACTIVE   = "/api/v1/walks/active"
LOCATIONS = "/api/v1/locations/"

# ─── Per-test isolation fixture ───────────────────────────────────────────────

@pytest.fixture(autouse=True)
def isolate(db: Session):
    """
    Wipe Walk and Location rows and flush the in-memory cache before and
    after every test. Prevents any walk state from leaking between tests.
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


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def patient(db: Session) -> Patient:
    """A standalone patient with a known device_token."""
    p = Patient(name="Walk Patient A", device_token=uuid4())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@pytest.fixture
def patient_b(db: Session) -> Patient:
    """A second, independent patient."""
    p = Patient(name="Walk Patient B", device_token=uuid4())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@pytest.fixture
def patient_headers(patient: Patient) -> dict:
    return {"X-Patient-Token": str(patient.device_token)}


@pytest.fixture
def patient_b_headers(patient_b: Patient) -> dict:
    return {"X-Patient-Token": str(patient_b.device_token)}


@pytest.fixture
def linked_patient(db: Session, caregiver_user: User) -> Patient:
    """Patient linked to the test caregiver (needed for JWT auth → resolve_patient)."""
    existing = next(
        (p for p in caregiver_user.patients if p.name == "Linked Walk Patient"), None
    )
    if existing:
        return existing
    p = Patient(name="Linked Walk Patient", device_token=uuid4())
    db.add(p)
    db.flush()
    caregiver_user.patients.append(p)
    db.commit()
    db.refresh(p)
    return p


# ─── Factory helpers ──────────────────────────────────────────────────────────

def _active_walk_count(db: Session) -> int:
    return db.query(Walk).filter(Walk.active == True).count()


def _total_walk_count(db: Session) -> int:
    return db.query(Walk).count()


def _location_payload(walk_id: int, lat=41.3874, lng=2.1686, ts="2026-04-25T10:00:00") -> dict:
    return {"latitude": lat, "longitude": lng, "timestamp": ts, "walk_id": walk_id}


def _seed_cache(walk_id: int, n: int = 3):
    """Pre-populate the cache with n dummy location points."""
    for i in range(n):
        walk_state_cache.update(walk_id, {
            "latitude":  41.3874 + i * 0.0001,
            "longitude": 2.1686  + i * 0.0001,
            "timestamp": f"2026-04-25T10:0{i}:00",
        })


# ─── A. Start — success path ──────────────────────────────────────────────────

class TestStartSuccess:

    def test_A1_returns_200_with_patient_token(
        self, client: TestClient, patient_headers: dict
    ):
        response = client.post(START, headers=patient_headers)
        assert response.status_code == 200

    def test_A2_returns_200_with_caregiver_jwt(
        self, client: TestClient, linked_patient: Patient, auth_headers: dict
    ):
        response = client.post(START, headers=auth_headers)
        assert response.status_code == 200

    def test_A3_response_is_a_positive_integer_walk_id(
        self, client: TestClient, patient_headers: dict
    ):
        """/start returns a bare int — not a wrapped JSON object."""
        walk_id = client.post(START, headers=patient_headers).json()
        assert isinstance(walk_id, int)
        assert walk_id > 0

    def test_A4_walk_row_is_active_in_db(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        walk_id = client.post(START, headers=patient_headers).json()
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk is not None
        assert walk.active is True

    def test_A5_walk_has_start_time(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        walk_id = client.post(START, headers=patient_headers).json()
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk.start_time is not None

    def test_A6_walk_initiated_by_patient_when_using_device_token(
        self, client: TestClient, db: Session,
        patient: Patient, patient_headers: dict,
    ):
        walk_id = client.post(START, headers=patient_headers).json()
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk.initiated_by_type == "patient"
        assert walk.initiated_by_id   == patient.id

    def test_A7_walk_initiated_by_caregiver_when_using_jwt(
        self, client: TestClient, db: Session,
        linked_patient: Patient, caregiver_user: User, auth_headers: dict,
    ):
        walk_id = client.post(START, headers=auth_headers).json()
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk.initiated_by_type == "caregiver"
        assert walk.initiated_by_id   == caregiver_user.id

    def test_A8_end_time_is_null_on_new_walk(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        walk_id = client.post(START, headers=patient_headers).json()
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk.end_time is None


# ─── B. Double-start prevention ───────────────────────────────────────────────

class TestDoubleStart:

    def test_B1_second_start_returns_400(
        self, client: TestClient, patient_headers: dict
    ):
        """Global active-walk constraint: only one walk at a time, system-wide."""
        client.post(START, headers=patient_headers)
        response = client.post(START, headers=patient_headers)
        assert response.status_code == 400

    def test_B2_error_detail_is_descriptive(
        self, client: TestClient, patient_headers: dict
    ):
        client.post(START, headers=patient_headers)
        detail = client.post(START, headers=patient_headers).json()["detail"]
        assert "active" in detail.lower()

    def test_B3_only_one_active_walk_exists_after_double_start(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        client.post(START, headers=patient_headers)
        client.post(START, headers=patient_headers)
        assert _active_walk_count(db) == 1

    def test_B4_second_patient_blocked_while_first_walk_is_active(
        self, client: TestClient,
        patient_headers: dict, patient_b_headers: dict,
    ):
        """
        The active-walk check is GLOBAL (no per-patient filter).
        Patient B cannot start a walk while Patient A's walk is active.
        """
        r1 = client.post(START, headers=patient_headers)
        assert r1.status_code == 200

        r2 = client.post(START, headers=patient_b_headers)
        assert r2.status_code == 400

    def test_B5_after_stop_a_new_start_succeeds(
        self, client: TestClient, patient_headers: dict
    ):
        """The global slot is freed after a stop — next start must succeed."""
        client.post(START, headers=patient_headers)
        client.post(STOP, headers=patient_headers)
        response = client.post(START, headers=patient_headers)
        assert response.status_code == 200


# ─── C. Stop — success path and response shape ───────────────────────────────

class TestStopSuccess:

    def test_C1_stop_returns_200(
        self, client: TestClient, patient_headers: dict
    ):
        client.post(START, headers=patient_headers)
        response = client.post(STOP, headers=patient_headers)
        assert response.status_code == 200

    def test_C2_response_contains_all_required_keys(
        self, client: TestClient, patient_headers: dict
    ):
        client.post(START, headers=patient_headers)
        body = client.post(STOP, headers=patient_headers).json()
        for key in ("id", "start_time", "end_time", "duration_seconds", "location_count"):
            assert key in body, f"Missing key: {key}"

    def test_C3_walk_is_inactive_in_db_after_stop(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        walk_id = client.post(START, headers=patient_headers).json()
        client.post(STOP, headers=patient_headers)

        db.expire_all()
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk.active is False

    def test_C4_end_time_is_set_after_stop(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        walk_id = client.post(START, headers=patient_headers).json()
        client.post(STOP, headers=patient_headers)

        db.expire_all()
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk.end_time is not None

    def test_C5_duration_seconds_is_non_negative(
        self, client: TestClient, patient_headers: dict
    ):
        client.post(START, headers=patient_headers)
        body = client.post(STOP, headers=patient_headers).json()
        assert body["duration_seconds"] >= 0

    def test_C6_location_count_is_zero_when_no_locations_posted(
        self, client: TestClient, patient_headers: dict
    ):
        client.post(START, headers=patient_headers)
        body = client.post(STOP, headers=patient_headers).json()
        assert body["location_count"] == 0

    def test_C7_location_count_reflects_persisted_locations(
        self, client: TestClient, patient_headers: dict
    ):
        walk_id = client.post(START, headers=patient_headers).json()

        for i in range(3):
            client.post(
                LOCATIONS,
                json=_location_payload(walk_id, ts=f"2026-04-25T10:0{i}:00"),
                headers=patient_headers,
            )

        body = client.post(STOP, headers=patient_headers).json()
        assert body["location_count"] == 3

    def test_C8_stopped_by_type_is_set_correctly(
        self, client: TestClient, db: Session,
        patient: Patient, patient_headers: dict,
    ):
        walk_id = client.post(START, headers=patient_headers).json()
        client.post(STOP, headers=patient_headers)

        db.expire_all()
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk.stopped_by_type == "patient"
        assert walk.stopped_by_id   == patient.id

    def test_C9_no_active_walk_in_db_after_stop(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        client.post(START, headers=patient_headers)
        client.post(STOP, headers=patient_headers)
        assert _active_walk_count(db) == 0


# ─── D. Stop clears cache ─────────────────────────────────────────────────────

class TestStopClearsCache:

    def test_D1_cache_is_empty_after_stop(
        self, client: TestClient, patient_headers: dict
    ):
        walk_id = client.post(START, headers=patient_headers).json()
        _seed_cache(walk_id, n=3)

        assert walk_state_cache.get(walk_id) is not None  # pre-condition

        client.post(STOP, headers=patient_headers)

        assert walk_state_cache.get(walk_id) is None

    def test_D2_cache_cleared_even_when_seeded_via_post_locations(
        self, client: TestClient, patient_headers: dict
    ):
        """Cache populated through the real /locations endpoint must be cleared on stop."""
        walk_id = client.post(START, headers=patient_headers).json()

        for i in range(5):
            client.post(
                LOCATIONS,
                json=_location_payload(walk_id, ts=f"2026-04-25T10:0{i}:00"),
                headers=patient_headers,
            )

        assert walk_state_cache.get(walk_id) is not None  # pre-condition

        client.post(STOP, headers=patient_headers)
        assert walk_state_cache.get(walk_id) is None

    def test_D3_cache_already_empty_on_stop_does_not_crash(
        self, client: TestClient, patient_headers: dict
    ):
        """If cache was never populated (e.g. after server restart), stop must succeed."""
        client.post(START, headers=patient_headers)
        # Do NOT seed the cache — it starts empty
        response = client.post(STOP, headers=patient_headers)
        assert response.status_code == 200

    def test_D4_other_walk_cache_entries_unaffected(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        """
        Stopping one walk must not evict cache entries for other walk IDs
        (e.g. past walk data retained for audit / history purposes).
        """
        # Pre-seed cache for a fictitious past walk
        past_walk_id = 9999
        _seed_cache(past_walk_id, n=2)

        walk_id = client.post(START, headers=patient_headers).json()
        _seed_cache(walk_id, n=2)

        client.post(STOP, headers=patient_headers)

        # Current walk cache cleared
        assert walk_state_cache.get(walk_id) is None
        # Past walk cache untouched
        assert walk_state_cache.get(past_walk_id) is not None


# ─── E. Stop without active walk → 404 ───────────────────────────────────────

class TestStopWithoutActiveWalk:

    def test_E1_stop_with_no_walk_returns_404(
        self, client: TestClient, patient_headers: dict
    ):
        response = client.post(STOP, headers=patient_headers)
        assert response.status_code == 404

    def test_E2_error_detail_mentions_active_walk(
        self, client: TestClient, patient_headers: dict
    ):
        detail = client.post(STOP, headers=patient_headers).json()["detail"]
        assert "active" in detail.lower()

    def test_E3_stop_after_stop_returns_404(
        self, client: TestClient, patient_headers: dict
    ):
        """Double-stop: the second call must be rejected."""
        client.post(START, headers=patient_headers)
        client.post(STOP, headers=patient_headers)
        response = client.post(STOP, headers=patient_headers)
        assert response.status_code == 404

    def test_E4_failed_stop_does_not_modify_db(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        """No walk exists — stop must be a pure no-op on the DB."""
        before = _total_walk_count(db)
        client.post(STOP, headers=patient_headers)
        assert _total_walk_count(db) == before

    def test_E5_failed_stop_does_not_modify_cache(
        self, client: TestClient, patient_headers: dict
    ):
        """No walk exists — stop must not touch the cache."""
        _seed_cache(walk_id=42, n=2)
        client.post(STOP, headers=patient_headers)
        # The seeded entry must still be there
        assert walk_state_cache.get(42) is not None


# ─── F. Auth validation ───────────────────────────────────────────────────────

class TestAuthValidation:

    def test_F1_start_with_no_credentials_returns_401(self, client: TestClient):
        assert client.post(START).status_code == 401

    def test_F2_stop_with_no_credentials_returns_401(self, client: TestClient):
        assert client.post(STOP).status_code == 401

    def test_F3_start_with_invalid_jwt_returns_401(self, client: TestClient):
        assert client.post(
            START, headers={"Authorization": "Bearer totally.fake.token"}
        ).status_code == 401

    def test_F4_stop_with_invalid_jwt_returns_401(self, client: TestClient):
        assert client.post(
            STOP, headers={"Authorization": "Bearer totally.fake.token"}
        ).status_code == 401

    def test_F5_start_with_unknown_device_token_returns_401(self, client: TestClient):
        assert client.post(
            START, headers={"X-Patient-Token": str(uuid4())}
        ).status_code == 401

    def test_F6_stop_with_unknown_device_token_returns_401(self, client: TestClient):
        assert client.post(
            STOP, headers={"X-Patient-Token": str(uuid4())}
        ).status_code == 401

    def test_F7_auth_failure_on_start_leaves_db_unchanged(
        self, client: TestClient, db: Session
    ):
        before = _total_walk_count(db)
        client.post(START)
        assert _total_walk_count(db) == before

    def test_F8_auth_failure_on_stop_leaves_cache_unchanged(
        self, client: TestClient
    ):
        _seed_cache(walk_id=1, n=2)
        client.post(STOP)   # no auth
        assert walk_state_cache.get(1) is not None


# ─── G. Full integration: start → locations → stop → /walks/active ───────────

class TestFullIntegration:

    def test_G1_complete_walk_lifecycle(
        self, client: TestClient, db: Session,
        patient: Patient, patient_headers: dict,
    ):
        """
        Drive the full walk lifecycle through the HTTP API and verify
        DB + cache consistency at every phase.
        """
        # ── Phase 1: start ───────────────────────────────────────────────────
        r_start = client.post(START, headers=patient_headers)
        assert r_start.status_code == 200
        walk_id = r_start.json()

        assert _active_walk_count(db) == 1

        # ── Phase 2: send 3 GPS points ───────────────────────────────────────
        points = [
            (41.3874, 2.1686, "2026-04-25T10:00:00"),
            (41.3881, 2.1692, "2026-04-25T10:00:30"),
            (41.3889, 2.1701, "2026-04-25T10:01:00"),
        ]
        for lat, lng, ts in points:
            r = client.post(
                LOCATIONS,
                json=_location_payload(walk_id, lat=lat, lng=lng, ts=ts),
                headers=patient_headers,
            )
            assert r.status_code == 200

        assert walk_state_cache.get(walk_id) is not None
        assert len(walk_state_cache.get(walk_id)["history"]) == 3

        # ── Phase 3: verify /walks/active shows live state ───────────────────
        r_active = client.get(ACTIVE, headers=patient_headers)
        assert r_active.status_code == 200
        active_body = r_active.json()
        assert active_body["active_walk_id"] == walk_id
        assert active_body["latest_location"]["latitude"] == pytest.approx(41.3889)

        # ── Phase 4: stop ────────────────────────────────────────────────────
        r_stop = client.post(STOP, headers=patient_headers)
        assert r_stop.status_code == 200
        stop_body = r_stop.json()
        assert stop_body["location_count"] == 3
        assert stop_body["duration_seconds"] >= 0

        # ── Phase 5: verify post-stop state ──────────────────────────────────
        # Cache cleared
        assert walk_state_cache.get(walk_id) is None

        # DB walk is inactive
        db.expire_all()
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk.active is False
        assert walk.end_time is not None

        # /walks/active returns no active walk
        r_final = client.get(ACTIVE, headers=patient_headers)
        assert r_final.json() == {"active_walk": None}

    def test_G2_new_walk_can_start_immediately_after_stop(
        self, client: TestClient, patient_headers: dict
    ):
        """The slot must be free immediately after stop — no cooldown."""
        client.post(START, headers=patient_headers)
        client.post(STOP,  headers=patient_headers)

        r = client.post(START, headers=patient_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), int)

    def test_G3_location_rows_survive_after_walk_stop(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        """Location rows belong to the walk and must persist after stop."""
        walk_id = client.post(START, headers=patient_headers).json()

        for i in range(4):
            client.post(
                LOCATIONS,
                json=_location_payload(walk_id, ts=f"2026-04-25T10:0{i}:00"),
                headers=patient_headers,
            )

        client.post(STOP, headers=patient_headers)

        count = db.query(Location).filter(Location.walk_id == walk_id).count()
        assert count == 4


# ─── H. Edge cases ───────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_H1_rapid_start_stop_sequence_maintains_db_consistency(
        self, client: TestClient, db: Session, patient_headers: dict
    ):
        """Three rapid start→stop cycles must produce 3 inactive walks and 0 active."""
        for _ in range(3):
            r1 = client.post(START, headers=patient_headers)
            assert r1.status_code == 200
            r2 = client.post(STOP, headers=patient_headers)
            assert r2.status_code == 200

        assert _active_walk_count(db) == 0
        assert _total_walk_count(db)  == 3

    def test_H2_cache_state_is_correct_across_multiple_cycles(
        self, client: TestClient, patient_headers: dict
    ):
        """After 3 cycles, the cache must contain NO active walk entries."""
        last_walk_id = None
        for _ in range(3):
            last_walk_id = client.post(START, headers=patient_headers).json()
            _seed_cache(last_walk_id, n=2)
            client.post(STOP, headers=patient_headers)

        assert walk_state_cache.get(last_walk_id) is None

    def test_H3_stop_returns_correct_walk_id(
        self, client: TestClient, patient_headers: dict
    ):
        """stop response 'id' must match the walk_id returned by start."""
        walk_id = client.post(START, headers=patient_headers).json()
        stop_body = client.post(STOP, headers=patient_headers).json()
        assert stop_body["id"] == walk_id

    def test_H4_start_with_malformed_device_token_returns_401(
        self, client: TestClient
    ):
        response = client.post(
            START, headers={"X-Patient-Token": "this-is-not-a-uuid"}
        )
        assert response.status_code == 401
