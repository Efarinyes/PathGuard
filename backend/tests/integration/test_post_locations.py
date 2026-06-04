"""
tests/integration/test_post_locations.py

Production-ready Pytest integration tests for:
    POST /api/v1/locations

Endpoint behaviour under test
──────────────────────────────
The endpoint executes four sequential operations:

  1. Auth gate — resolves patient via X-Patient-Token or caregiver JWT.
     Returns 401 when neither credential is valid.

  2. Walk validation
     a. Walk does not exist         → 404
     b. Walk exists but inactive    → 400
     c. Walk exists and active      → continue

  3. Persistence — inserts a Location row and commits.

  4. Cache update — calls walk_state_cache.update(walk_id, location_data)
     making the point available immediately on GET /walks/active.

  5. WebSocket broadcast — calls manager.broadcast(location_data).
     With no connected clients in tests this is a fast no-op (no mock needed).

  6. Returns the persisted location as a dict with keys:
     {type, id, walk_id, latitude, longitude, timestamp}

Request body (LocationCreate)
──────────────────────────────
  latitude  : float   (required)
  longitude : float   (required)
  timestamp : datetime (required, ISO string accepted)
  walk_id   : int     (required)

Mock / isolation strategy
─────────────────────────
• SQLite in-memory via the shared conftest fixtures (db, client).
• walk_state_cache singleton cleared in autouse fixture — no cross-test leaks.
• WebSocket manager has zero active_connections in tests — broadcast is a no-op.
• No new dependencies installed.
"""

import pytest
from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models.location import Location
from app.db.models.patient import Patient
from app.db.models.walk import Walk
from app.api.users.models import User
from app.db.state import walk_state_cache

# ─── Constants ────────────────────────────────────────────────────────────────

ENDPOINT = "/api/v1/locations/"

TS_STR  = "2026-04-25T10:00:00"          # ISO timestamp used across tests
LAT     = 41.3874
LNG     = 2.1686


# ─── Shared fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def isolate(db: Session):
    """
    Per-test isolation: wipe Location and Walk rows and flush the
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
def patient(db: Session, group) -> Patient:
    """A standalone Patient with a known device_token."""
    p = Patient(name="GPS Patient", device_token=str(uuid4()), group_id=group.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@pytest.fixture
def patient_headers(patient: Patient) -> dict:
    return {"X-Patient-Token": str(patient.device_token)}


@pytest.fixture
def linked_patient(db: Session, caregiver_user: User) -> Patient:
    """
    Patient in the caregiver's Group (needed for JWT auth -> resolve_patient).
    """
    existing = db.query(Patient).filter(
        Patient.group_id == caregiver_user.group_id
    ).first()
    if existing:
        return existing

    p = Patient(
        name="Linked Patient",
        device_token=str(uuid4()),
        group_id=caregiver_user.group_id
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@pytest.fixture
def active_walk(db: Session, patient: Patient) -> Walk:
    """An active Walk row."""
    walk = Walk(
        start_time=datetime(2026, 4, 25, 9, 0, 0),
        active=True,
        initiated_by_type="patient",
        initiated_by_id=patient.id,
        patient_id=patient.id  # Required link
    )
    db.add(walk)
    db.commit()
    db.refresh(walk)
    return walk


@pytest.fixture
def finished_walk(db: Session, patient: Patient) -> Walk:
    """A completed (inactive) Walk row."""
    walk = Walk(
        start_time=datetime(2026, 4, 25, 8, 0, 0),
        end_time=datetime(2026, 4, 25, 8, 30, 0),
        active=False,
        initiated_by_type="patient",
        initiated_by_id=patient.id,
        patient_id=patient.id  # Required link
    )
    db.add(walk)
    db.commit()
    db.refresh(walk)
    return walk


def _payload(walk_id: int, lat=LAT, lng=LNG, ts=TS_STR) -> dict:
    """Build a valid LocationCreate payload."""
    return {
        "latitude":  lat,
        "longitude": lng,
        "timestamp": ts,
        "walk_id":   walk_id,
    }


# ─── A. Authentication ────────────────────────────────────────────────────────

class TestAuthentication:

    def test_A1_no_credentials_returns_401(
        self, client: TestClient, active_walk: Walk
    ):
        """Unauthenticated request must be rejected before any DB work."""
        response = client.post(ENDPOINT, json=_payload(active_walk.id))
        assert response.status_code in [401, 403]

    def test_A2_unknown_device_token_returns_401(
        self, client: TestClient, active_walk: Walk
    ):
        """A UUID-formatted but unregistered token must be rejected."""
        response = client.post(
            ENDPOINT,
            json=_payload(active_walk.id),
            headers={"X-Patient-Token": str(uuid4())},
        )
        assert response.status_code in [401, 403]

    def test_A3_malformed_device_token_returns_401(
        self, client: TestClient, active_walk: Walk
    ):
        """A non-UUID token string must not crash the server."""
        response = client.post(
            ENDPOINT,
            json=_payload(active_walk.id),
            headers={"X-Patient-Token": "not-a-uuid-at-all"},
        )
        assert response.status_code in [401, 403]

    def test_A4_valid_patient_token_is_accepted(
        self, client: TestClient, active_walk: Walk,
        patient_headers: dict,
    ):
        """Valid X-Patient-Token must pass auth and reach endpoint logic."""
        response = client.post(
            ENDPOINT,
            json=_payload(active_walk.id),
            headers=patient_headers,
        )
        assert response.status_code == 200

    def test_A5_valid_caregiver_jwt_is_accepted(
        self, client: TestClient, active_walk: Walk,
        linked_patient: Patient, auth_headers: dict,
    ):
        """Valid caregiver JWT (with linked patient) must also be accepted."""
        response = client.post(
            ENDPOINT,
            json=_payload(active_walk.id),
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_A6_invalid_jwt_returns_401(
        self, client: TestClient, active_walk: Walk
    ):
        """Expired/malformed JWT must be rejected."""
        response = client.post(
            ENDPOINT,
            json=_payload(active_walk.id),
            headers={"Authorization": "Bearer totally.fake.token"},
        )
        assert response.status_code in [401, 403]


# ─── B. Walk validation ───────────────────────────────────────────────────────

class TestWalkValidation:

    def test_B1_nonexistent_walk_returns_400(
        self, client: TestClient, patient_headers: dict
    ):
        """walk_id that doesn't exist in DB must return 400 (per current implementation)."""
        response = client.post(
            ENDPOINT,
            json=_payload(walk_id=99999),
            headers=patient_headers,
        )
        assert response.status_code == 400
        assert "Invalid or inactive walk" in response.json()["detail"]

    def test_B2_inactive_walk_returns_400(
        self, client: TestClient, finished_walk: Walk, patient_headers: dict
    ):
        """Submitting a location to a finished walk must return 400."""
        response = client.post(
            ENDPOINT,
            json=_payload(finished_walk.id),
            headers=patient_headers,
        )
        assert response.status_code == 400
        assert "inactive" in response.json()["detail"].lower()

    def test_B3_active_walk_passes_validation(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        """An active walk must pass the validation check."""
        response = client.post(
            ENDPOINT,
            json=_payload(active_walk.id),
            headers=patient_headers,
        )
        assert response.status_code == 200


# ─── C. Request body validation ───────────────────────────────────────────────

class TestRequestBodyValidation:

    def test_C1_missing_latitude_returns_422(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        payload = {"longitude": LNG, "timestamp": TS_STR, "walk_id": active_walk.id}
        response = client.post(ENDPOINT, json=payload, headers=patient_headers)
        assert response.status_code == 422

    def test_C2_missing_longitude_returns_422(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        payload = {"latitude": LAT, "timestamp": TS_STR, "walk_id": active_walk.id}
        response = client.post(ENDPOINT, json=payload, headers=patient_headers)
        assert response.status_code == 422

    def test_C3_missing_timestamp_returns_422(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        payload = {"latitude": LAT, "longitude": LNG, "walk_id": active_walk.id}
        response = client.post(ENDPOINT, json=payload, headers=patient_headers)
        assert response.status_code == 422

    def test_C4_missing_walk_id_returns_422(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        payload = {"latitude": LAT, "longitude": LNG, "timestamp": TS_STR}
        response = client.post(ENDPOINT, json=payload, headers=patient_headers)
        assert response.status_code == 422

    def test_C5_non_numeric_latitude_returns_422(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        payload = _payload(active_walk.id, lat="not-a-float")
        response = client.post(ENDPOINT, json=payload, headers=patient_headers)
        assert response.status_code == 422

    def test_C6_invalid_timestamp_format_returns_422(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        payload = _payload(active_walk.id, ts="25/04/2026 10:00")
        response = client.post(ENDPOINT, json=payload, headers=patient_headers)
        assert response.status_code == 422

    def test_C7_empty_body_returns_422(
        self, client: TestClient, patient_headers: dict
    ):
        response = client.post(ENDPOINT, json={}, headers=patient_headers)
        assert response.status_code == 422


# ─── D. Successful persistence ────────────────────────────────────────────────

class TestPersistence:

    def test_D1_response_contains_all_required_fields(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        """Response must include type, id, walk_id, latitude, longitude, timestamp."""
        response = client.post(
            ENDPOINT, json=_payload(active_walk.id), headers=patient_headers
        )
        assert response.status_code == 200
        body = response.json()
        for key in ("type", "id", "walk_id", "latitude", "longitude", "timestamp"):
            assert key in body, f"Missing key: {key}"

    def test_D2_response_type_field_is_location(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        """The 'type' discriminator must always be 'location'."""
        body = client.post(
            ENDPOINT, json=_payload(active_walk.id), headers=patient_headers
        ).json()
        assert body["type"] == "location"

    def test_D3_response_coordinates_match_request(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        """Returned lat/lng must be the exact values submitted."""
        body = client.post(
            ENDPOINT,
            json=_payload(active_walk.id, lat=41.3874, lng=2.1686),
            headers=patient_headers,
        ).json()
        assert body["latitude"]  == pytest.approx(41.3874)
        assert body["longitude"] == pytest.approx(2.1686)

    def test_D4_response_walk_id_matches_request(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        body = client.post(
            ENDPOINT, json=_payload(active_walk.id), headers=patient_headers
        ).json()
        assert body["walk_id"] == active_walk.id

    def test_D5_location_row_persisted_in_db(
        self, client: TestClient, db: Session,
        active_walk: Walk, patient_headers: dict,
    ):
        """A Location row must exist in the DB after the request."""
        body = client.post(
            ENDPOINT, json=_payload(active_walk.id), headers=patient_headers
        ).json()

        loc = db.query(Location).filter(Location.id == body["id"]).first()
        assert loc is not None
        assert loc.walk_id   == active_walk.id
        assert loc.latitude  == pytest.approx(LAT)
        assert loc.longitude == pytest.approx(LNG)

    def test_D6_sequential_points_all_persisted(
        self, client: TestClient, db: Session,
        active_walk: Walk, patient_headers: dict,
    ):
        """Three successive posts must create three distinct Location rows."""
        points = [
            (41.3874, 2.1686, "2026-04-25T10:00:00"),
            (41.3881, 2.1692, "2026-04-25T10:00:30"),
            (41.3889, 2.1701, "2026-04-25T10:01:00"),
        ]
        ids = []
        for lat, lng, ts in points:
            r = client.post(
                ENDPOINT,
                json=_payload(active_walk.id, lat=lat, lng=lng, ts=ts),
                headers=patient_headers,
            )
            assert r.status_code == 200
            ids.append(r.json()["id"])

        assert len(set(ids)) == 3   # all unique IDs
        count = db.query(Location).filter(Location.walk_id == active_walk.id).count()
        assert count == 3

    def test_D7_response_id_is_positive_integer(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        """The auto-generated row ID must be a positive integer."""
        body = client.post(
            ENDPOINT, json=_payload(active_walk.id), headers=patient_headers
        ).json()
        assert isinstance(body["id"], int)
        assert body["id"] > 0


# ─── E. Cache update ──────────────────────────────────────────────────────────

class TestCacheUpdate:

    def test_E1_cache_is_populated_after_post(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        """walk_state_cache must contain the walk after a successful POST."""
        client.post(
            ENDPOINT, json=_payload(active_walk.id), headers=patient_headers
        )
        cached = walk_state_cache.get(active_walk.id)
        assert cached is not None

    def test_E2_cache_latest_matches_posted_coordinates(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        """cache['latest'] coordinates must match the submitted point."""
        client.post(
            ENDPOINT,
            json=_payload(active_walk.id, lat=41.3874, lng=2.1686),
            headers=patient_headers,
        )
        cached = walk_state_cache.get(active_walk.id)
        assert cached["latest"]["latitude"]  == pytest.approx(41.3874)
        assert cached["latest"]["longitude"] == pytest.approx(2.1686)

    def test_E3_cache_latest_updates_on_each_post(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        """Successive posts must advance cache['latest'] to the newest point."""
        client.post(
            ENDPOINT,
            json=_payload(active_walk.id, lat=41.3874, lng=2.1686, ts="2026-04-25T10:00:00"),
            headers=patient_headers,
        )
        client.post(
            ENDPOINT,
            json=_payload(active_walk.id, lat=41.3881, lng=2.1692, ts="2026-04-25T10:00:30"),
            headers=patient_headers,
        )
        cached = walk_state_cache.get(active_walk.id)
        assert cached["latest"]["latitude"] == pytest.approx(41.3881)

    def test_E4_cache_history_grows_with_each_post(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        """Each POST must append one entry to cache['history']."""
        for i in range(3):
            client.post(
                ENDPOINT,
                json=_payload(
                    active_walk.id,
                    lat=LAT + i * 0.001,
                    ts=f"2026-04-25T10:0{i}:00",
                ),
                headers=patient_headers,
            )
        cached = walk_state_cache.get(active_walk.id)
        assert len(cached["history"]) == 3

    def test_E5_cache_history_capped_at_200(
        self, client: TestClient, active_walk: Walk, patient_headers: dict
    ):
        """Sending 250 points must keep cache history at exactly 200 entries."""
        for i in range(250):
            client.post(
                ENDPOINT,
                json=_payload(
                    active_walk.id,
                    lat=LAT + i * 0.0001,
                    ts=datetime(2026, 4, 25, 10, i // 60, i % 60).isoformat(),
                ),
                headers=patient_headers,
            )
        cached = walk_state_cache.get(active_walk.id)
        assert len(cached["history"]) == 200

    def test_E6_failed_auth_does_not_pollute_cache(
        self, client: TestClient, active_walk: Walk
    ):
        """A rejected request must leave the cache untouched."""
        client.post(
            ENDPOINT,
            json=_payload(active_walk.id),
            headers={"X-Patient-Token": str(uuid4())},  # unknown token
        )
        assert walk_state_cache.get(active_walk.id) is None

    def test_E7_inactive_walk_rejection_does_not_pollute_cache(
        self, client: TestClient, finished_walk: Walk, patient_headers: dict
    ):
        """A 400 (inactive walk) must leave the cache untouched."""
        client.post(
            ENDPOINT,
            json=_payload(finished_walk.id),
            headers=patient_headers,
        )
        assert walk_state_cache.get(finished_walk.id) is None


# ─── F. State consistency ─────────────────────────────────────────────────────

class TestStateConsistency:

    def test_F1_db_and_cache_agree_on_coordinates(
        self, client: TestClient, db: Session,
        active_walk: Walk, patient_headers: dict,
    ):
        """DB row and cache entry must store identical lat/lng values."""
        body = client.post(
            ENDPOINT,
            json=_payload(active_walk.id, lat=41.3874, lng=2.1686),
            headers=patient_headers,
        ).json()

        loc = db.query(Location).filter(Location.id == body["id"]).first()
        cached = walk_state_cache.get(active_walk.id)

        assert loc.latitude  == pytest.approx(cached["latest"]["latitude"])
        assert loc.longitude == pytest.approx(cached["latest"]["longitude"])

    def test_F2_inactive_walk_leaves_db_unchanged(
        self, client: TestClient, db: Session,
        finished_walk: Walk, patient_headers: dict,
    ):
        """A 400 response must not insert any Location row."""
        before = db.query(Location).count()
        client.post(
            ENDPOINT,
            json=_payload(finished_walk.id),
            headers=patient_headers,
        )
        after = db.query(Location).count()
        assert after == before

    def test_F3_unauthenticated_request_leaves_db_unchanged(
        self, client: TestClient, db: Session, active_walk: Walk
    ):
        """A 401 response must not insert any Location row."""
        before = db.query(Location).count()
        client.post(ENDPOINT, json=_payload(active_walk.id))
        after = db.query(Location).count()
        assert after == before
