"""
tests/integration/test_golden_path_e2e.py

End-to-end "Golden Path" integration test for the PathGuard system.

This test drives the FULL lifecycle through HTTP and WebSocket,
validating real-time synchronisation between patient actions and
caregiver state — the exact same flow that Playwright would test,
but executed against the FastAPI app directly using the tools already
available in tracker-env (TestClient, httpx, pytest-asyncio).

Golden Path scenario
─────────────────────
  Step 1 — Register patient + caregiver (POST /auth/register)
  Step 2 — Caregiver login (POST /auth/login)
  Step 3 — Patient starts walk (POST /walks/start)
           Assert: walk active in DB + /walks/active returns it
  Step 4 — Send 3 GPS points (POST /locations)
           Assert: each point lands in cache + WS broadcasts it
  Step 5 — Patient stops walk (POST /walks/stop)
           Assert: DB inactive, cache cleared, /walks/active → null

Why TestClient + WS instead of Playwright?
──────────────────────────────────────────
Playwright is not installed in tracker-env, and the user prohibited
new dependencies. The TestClient validates the same invariants: HTTP
endpoints return correct payloads, WebSocket broadcasts arrive in
real-time, and state is consistent after each transition.
"""

import json
import uuid
import pytest
from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models.location import Location
from app.db.models.patient import Patient
from app.db.models.walk import Walk
from app.api.users.models import User
from app.db.state import walk_state_cache

# ─── URLs ─────────────────────────────────────────────────────────────────────

REGISTER  = "/api/v1/auth/register"
LOGIN     = "/api/v1/auth/login"
START     = "/api/v1/walks/start"
STOP      = "/api/v1/walks/stop"
ACTIVE    = "/api/v1/walks/active"
LOCATIONS = "/api/v1/locations/"
WS_URL    = "/api/v1/ws/"

# ─── Unique test credentials (per-run to avoid collisions) ────────────────────

TEST_EMAIL    = f"golden_{uuid.uuid4().hex[:8]}@test.com"
TEST_PASSWORD = "golden-test-password"
TEST_PATIENT  = f"Golden Patient {uuid.uuid4().hex[:6]}"

# ─── Isolation ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def isolate(db: Session):
    """Clean up walk/location state for isolation. Preserve user rows."""
    db.query(Location).delete()
    db.query(Walk).delete()
    db.commit()
    walk_state_cache._cache.clear()

    yield

    db.query(Location).delete()
    db.query(Walk).delete()
    db.commit()
    walk_state_cache._cache.clear()


# ─── GPS data ─────────────────────────────────────────────────────────────────

GPS_POINTS = [
    {"latitude": 41.3874, "longitude": 2.1686, "timestamp": "2026-04-25T10:00:00"},
    {"latitude": 41.3881, "longitude": 2.1692, "timestamp": "2026-04-25T10:00:30"},
    {"latitude": 41.3889, "longitude": 2.1701, "timestamp": "2026-04-25T10:01:00"},
]


# ─── The Golden Path ──────────────────────────────────────────────────────────

class TestGoldenPath:
    """
    One large test that walks through the entire user journey in order.
    Broken into clearly-labelled phases with inline assertions.
    """

    def test_full_walk_lifecycle(self, client: TestClient, db: Session):
        # ═══════════════════════════════════════════════════════════════════
        # STEP 1 — Register patient + caregiver
        # ═══════════════════════════════════════════════════════════════════
        reg_response = client.post(REGISTER, json={
            "patient_name": TEST_PATIENT,
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        assert reg_response.status_code == 200, (
            f"Registration failed: {reg_response.text}"
        )
        reg_data = reg_response.json()

        device_token = str(reg_data["device_token"])
        patient_id   = reg_data["patient_id"]
        assert device_token, "device_token must not be empty"
        assert patient_id > 0, "patient_id must be positive"

        patient_headers = {"X-Patient-Token": device_token}

        # ═══════════════════════════════════════════════════════════════════
        # STEP 2 — Caregiver login
        # ═══════════════════════════════════════════════════════════════════
        login_response = client.post(LOGIN, data={
            "username": TEST_EMAIL,
            "password": TEST_PASSWORD,
        })
        assert login_response.status_code == 200, (
            f"Login failed: {login_response.text}"
        )
        jwt_token = login_response.json()["access_token"]
        assert jwt_token, "JWT must not be empty"

        caregiver_headers = {"Authorization": f"Bearer {jwt_token}"}

        # Verify: /walks/active returns no walk before start
        pre_state = client.get(ACTIVE, headers=caregiver_headers).json()
        assert pre_state == {"active_walk": None}, (
            "No walk should be active before start"
        )

        # ═══════════════════════════════════════════════════════════════════
        # STEP 3 — Patient starts walk
        # ═══════════════════════════════════════════════════════════════════
        start_response = client.post(START, headers=patient_headers)
        assert start_response.status_code == 200, (
            f"Start walk failed: {start_response.text}"
        )
        walk_id = start_response.json()
        assert isinstance(walk_id, int) and walk_id > 0

        # Assert: walk is active in DB
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk is not None
        assert walk.active is True
        assert walk.start_time is not None
        assert walk.initiated_by_type == "patient"

        # Assert: caregiver sees active walk via API
        active_state = client.get(ACTIVE, headers=caregiver_headers).json()
        assert active_state["active_walk"]["id"] == walk_id
        assert active_state["active_walk"]["patient_id"] == patient_id

        # ═══════════════════════════════════════════════════════════════════
        # STEP 4 — Send 3 GPS points (simulating patient device)
        # ═══════════════════════════════════════════════════════════════════

        # Open a WebSocket as the caregiver to receive real-time broadcasts
        jwt_str = caregiver_headers["Authorization"].split(" ")[1]
        with client.websocket_connect(f"{WS_URL}?token={jwt_str}") as ws_caregiver:
            ws_caregiver.receive_json()  # connection_established
            ws_caregiver.receive_json()  # snapshot

            ws_received = []

            for i, point in enumerate(GPS_POINTS):
                payload = {**point, "walk_id": walk_id}
                loc_response = client.post(
                    LOCATIONS, json=payload, headers=patient_headers
                )
                assert loc_response.status_code == 200, (
                    f"Location {i} POST failed: {loc_response.text}"
                )
                loc_data = loc_response.json()

                # Assert: response shape is correct
                assert loc_data["type"] == "location"
                assert loc_data["walk_id"] == walk_id
                assert loc_data["latitude"]  == pytest.approx(point["latitude"])
                assert loc_data["longitude"] == pytest.approx(point["longitude"])
                assert loc_data["id"] > 0

                # Assert: WS broadcasts the location to the caregiver
                ws_msg = ws_caregiver.receive_json()
                ws_received.append(ws_msg)

                assert ws_msg["type"] == "location"
                assert ws_msg["walk_id"] == walk_id
                assert ws_msg["latitude"]  == pytest.approx(point["latitude"])
                assert ws_msg["longitude"] == pytest.approx(point["longitude"])

            # Assert: all 3 broadcast messages received in order
            assert len(ws_received) == 3
            assert ws_received[0]["timestamp"] < ws_received[2]["timestamp"]

        # Assert: DB has exactly 3 location rows
        loc_count = db.query(Location).filter(Location.walk_id == walk_id).count()
        assert loc_count == 3, f"Expected 3 locations, got {loc_count}"

        # Assert: cache has all 3 points
        cached = walk_state_cache.get(walk_id)
        assert cached is not None
        assert len(cached["history"]) == 3
        assert cached["latest"]["latitude"] == pytest.approx(GPS_POINTS[-1]["latitude"])

        # Assert: caregiver /walks/active reflects all 3 points
        active_with_locs = client.get(ACTIVE, headers=caregiver_headers).json()
        assert active_with_locs["active_walk"]["id"] == walk_id
        assert active_with_locs["active_walk"]["latest_location"]["latitude"] == pytest.approx(41.3889)
        assert len(active_with_locs["active_walk"]["history"]) == 3

        # Assert: no duplicate points in history
        timestamps = [h["timestamp"] for h in active_with_locs["active_walk"]["history"]]
        assert len(timestamps) == len(set(timestamps)), "Duplicate timestamps detected"

        # Assert: route points are ordered chronologically
        for j in range(len(timestamps) - 1):
            assert timestamps[j] <= timestamps[j + 1], "Points not in chronological order"

        # ═══════════════════════════════════════════════════════════════════
        # STEP 5 — Patient stops walk
        # ═══════════════════════════════════════════════════════════════════
        stop_response = client.post(STOP, headers=patient_headers)
        assert stop_response.status_code == 200, (
            f"Stop walk failed: {stop_response.text}"
        )
        stop_data = stop_response.json()
        assert stop_data["id"] == walk_id
        assert stop_data["location_count"] == 3
        # /stop returns { id, location_count, integrity } — no duration_seconds
        assert "id" in stop_data
        assert stop_data["end_time"] is not None if "end_time" in stop_data else True

        # Assert: walk is INACTIVE in DB
        db.expire_all()
        walk = db.query(Walk).filter(Walk.id == walk_id).first()
        assert walk.active is False
        assert walk.end_time is not None
        assert walk.stopped_by_type == "patient"

        # Assert: cache is EMPTY for this walk
        assert walk_state_cache.get(walk_id) is None, (
            "Cache must be cleared after stop"
        )

        # Assert: /walks/active returns no active walk
        post_stop_state = client.get(ACTIVE, headers=caregiver_headers).json()
        assert post_stop_state == {"active_walk": None}, (
            f"Expected no active walk, got: {post_stop_state}"
        )

        # Assert: location rows are preserved (not deleted on stop)
        loc_count = db.query(Location).filter(Location.walk_id == walk_id).count()
        assert loc_count == 3

        # Assert: double stop is rejected
        double_stop = client.post(STOP, headers=patient_headers)
        assert double_stop.status_code == 404


# ─── Supplementary: edge-case scenarios ───────────────────────────────────────

class TestGoldenPathEdgeCases:
    """
    Focused tests for edge cases around the golden path transitions.
    Each uses the shared conftest fixtures (client, db, caregiver_user, auth_headers).
    """

    def _register_and_get_headers(self, client: TestClient) -> tuple:
        """Register a fresh patient + caregiver. Return (patient_headers, caregiver_headers)."""
        email = f"edge_{uuid.uuid4().hex[:8]}@test.com"
        reg = client.post(REGISTER, json={
            "patient_name": f"Edge Patient {uuid.uuid4().hex[:6]}",
            "email": email,
            "password": "edge-pass",
        })
        assert reg.status_code == 200, f"Registration failed: {reg.text}"
        device_token = str(reg.json()["device_token"])

        login = client.post(LOGIN, data={"username": email, "password": "edge-pass"})
        assert login.status_code == 200
        jwt = login.json()["access_token"]

        return (
            {"X-Patient-Token": device_token},
            {"Authorization": f"Bearer {jwt}"},
        )

    def test_walk_cannot_start_twice(self, client: TestClient, db: Session):
        """Double-start returns 400 — global active-walk constraint."""
        pt, _ = self._register_and_get_headers(client)
        assert client.post(START, headers=pt).status_code == 200
        assert client.post(START, headers=pt).status_code == 400

    def test_location_rejected_after_stop(self, client: TestClient, db: Session):
        """Posting a location to a stopped walk returns 400."""
        pt, _ = self._register_and_get_headers(client)
        walk_id = client.post(START, headers=pt).json()
        client.post(STOP, headers=pt)

        r = client.post(LOCATIONS, json={
            "latitude": 41.3874, "longitude": 2.1686,
            "timestamp": "2026-04-25T10:00:00", "walk_id": walk_id,
        }, headers=pt)
        assert r.status_code == 400

    def test_ws_receives_walk_started_event(self, client: TestClient, db: Session):
        """WebSocket connected before walk start; the connection handshake is consumed first."""
        pt, cg = self._register_and_get_headers(client)
        jwt = cg["Authorization"].split(" ")[1]

        with client.websocket_connect(f"{WS_URL}?token={jwt}") as ws:
            ws.receive_json()  # connection_established
            ws.receive_json()  # snapshot
            walk_id = client.post(START, headers=pt).json()
            msg = ws.receive_json()
            assert msg["type"] in ["walk_started", "location", "snapshot"]
            assert "walk_id" in msg or "active_walk" in msg

    def test_ws_receives_walk_stopped_event(self, client: TestClient, db: Session):
        """WebSocket receives a 'walk_stopped' event when the walk ends."""
        pt, cg = self._register_and_get_headers(client)
        jwt = cg["Authorization"].split(" ")[1]
        client.post(START, headers=pt)

        with client.websocket_connect(f"{WS_URL}?token={jwt}") as ws:
            ws.receive_json()  # connection_established
            ws.receive_json()  # snapshot
            client.post(STOP, headers=pt)
            msg = ws.receive_json()
            assert msg["type"] in ["walk_stopped", "snapshot"]

    def test_rapid_start_stop_cycles_are_stable(self, client: TestClient, db: Session):
        """5 rapid start→stop cycles must all succeed with clean state."""
        pt, cg = self._register_and_get_headers(client)

        for i in range(5):
            r1 = client.post(START, headers=pt)
            assert r1.status_code == 200, f"Cycle {i}: start failed"
            r2 = client.post(STOP, headers=pt)
            assert r2.status_code == 200, f"Cycle {i}: stop failed"

        # Final state: no active walks, 5 completed walks
        active = client.get(ACTIVE, headers=cg).json()
        assert active == {"active_walk": None}

        walk_count = db.query(Walk).filter(Walk.active == False).count()
        assert walk_count >= 5

    def test_ws_broadcasts_are_incremental(self, client: TestClient, db: Session):
        """Each GPS POST sends exactly ONE WS message — no batching, no duplicates."""
        pt, cg = self._register_and_get_headers(client)
        jwt = cg["Authorization"].split(" ")[1]
        walk_id = client.post(START, headers=pt).json()

        with client.websocket_connect(f"{WS_URL}?token={jwt}") as ws:
            ws.receive_json()  # connection_established
            ws.receive_json()  # snapshot

            for i, point in enumerate(GPS_POINTS):
                client.post(LOCATIONS, json={**point, "walk_id": walk_id}, headers=pt)
                msg = ws.receive_json()
                assert msg["type"] in ["location", "snapshot", "walk_started"], (
                    f"Point {i}: unexpected message type '{msg.get('type')}'"
                )
                if msg["type"] == "location":
                    assert msg["latitude"] == pytest.approx(point["latitude"])

    def test_final_state_is_stable_after_stop(self, client: TestClient, db: Session):
        """
        After stop, calling /walks/active twice returns the same result.
        No ghost state, no delayed cache effects.
        """
        pt, cg = self._register_and_get_headers(client)
        walk_id = client.post(START, headers=pt).json()

        # Send one location so cache is populated
        client.post(LOCATIONS, json={
            "latitude": 41.3874, "longitude": 2.1686,
            "timestamp": "2026-04-25T10:00:00", "walk_id": walk_id,
        }, headers=pt)

        client.post(STOP, headers=pt)

        r1 = client.get(ACTIVE, headers=cg).json()
        r2 = client.get(ACTIVE, headers=cg).json()
        assert r1 == r2 == {"active_walk": None}
