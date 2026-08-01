"""SPEC-185: honest 4-state presence from WS + HTTP timestamps."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from app.api.websocket.connection_manager import ConnectionManager
from app.api.websocket.snapshot_service import SnapshotService


@pytest.fixture
def manager() -> ConnectionManager:
    return ConnectionManager()


def test_presence_gps_online_when_http_recent_and_no_ws(manager: ConnectionManager):
    group_id = 1
    manager.update_http_presence(group_id)

    assert manager.get_presence_status(group_id) == "gps_online"


def test_presence_offline_when_no_ws_and_no_http(manager: ConnectionManager):
    assert manager.get_presence_status(99) == "offline"


def test_presence_online_when_ws_connected(manager: ConnectionManager):
    group_id = 2
    fake_ws = MagicMock()
    manager.patient_connections[group_id] = {fake_ws}
    manager.last_http_location_at[group_id] = datetime.now(timezone.utc) - timedelta(hours=1)

    assert manager.get_presence_status(group_id) == "online"


def test_presence_limbo_when_http_between_60_and_300s(manager: ConnectionManager):
    group_id = 3
    manager.last_http_location_at[group_id] = datetime.now(timezone.utc) - timedelta(seconds=120)

    assert manager.get_presence_status(group_id) == "limbo"


def test_presence_offline_when_http_older_than_300s(manager: ConnectionManager):
    group_id = 4
    manager.last_http_location_at[group_id] = datetime.now(timezone.utc) - timedelta(seconds=400)

    assert manager.get_presence_status(group_id) == "offline"


def test_snapshot_uses_presence_status_not_binary_store(manager: ConnectionManager):
    group_id = 5
    manager.set_patient_offline(group_id)
    manager.update_http_presence(group_id)

    db = MagicMock()
    # No active walk path: patient subquery / walk query return None
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.scalar_subquery.return_value = None

    service = SnapshotService(manager)
    payload = service.build_snapshot_payload(db, group_id, watchers_count=0)

    assert payload["patient_status"] == "gps_online"
    assert manager.get_patient_status(group_id) == "offline"
