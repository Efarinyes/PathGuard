import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config.settings import settings
from app.db.models.walk import Walk
from app.db.models.location import Location

def test_full_core_integration_flow(client: TestClient, db: Session):
    # Ensure a clean slate for walks
    db.query(Walk).delete()
    db.commit()

    # --- 1. Register ---
    register_payload = {
        "patient_name": "Integration Patient",
        "email": "integration_caregiver@test.com",
        "password": "IntegrationPassword123!"
    }

    register_res = client.post(f"{settings.API_V1_STR}/auth/register", json=register_payload)
    assert register_res.status_code == 200, f"Registration failed: {register_res.text}"
    
    register_data = register_res.json()
    device_token = register_data["device_token"]
    
    # --- 2. Start walk (patient) ---
    start_walk_res = client.post(
        f"{settings.API_V1_STR}/walks/start",
        headers={"X-Patient-Token": device_token}
    )
    assert start_walk_res.status_code == 200, f"Start walk failed: {start_walk_res.text}"
    
    walk_id = start_walk_res.json()
    
    # --- 3. Send location ---
    location_payload = {
        "latitude": 41.3851,
        "longitude": 2.1734,
        "timestamp": datetime.utcnow().isoformat(),
        "walk_id": walk_id
    }
    
    send_location_res = client.post(
        f"{settings.API_V1_STR}/locations/",
        json=location_payload,
        headers={"X-Patient-Token": device_token}
    )
    assert send_location_res.status_code == 200, f"Send location failed: {send_location_res.text}"
    location_data = send_location_res.json()
    
    # --- 4. Stop walk ---
    stop_walk_res = client.post(
        f"{settings.API_V1_STR}/walks/stop",
        headers={"X-Patient-Token": device_token}
    )
    assert stop_walk_res.status_code == 200, f"Stop walk failed: {stop_walk_res.text}"
    
    stop_data = stop_walk_res.json()
    assert stop_data["id"] == walk_id
    assert stop_data["location_count"] == 1
    
    # --- Assertions: DB Verification ---
    
    # 1. Walk exists and was updated properly
    db_walk = db.query(Walk).filter(Walk.id == walk_id).first()
    assert db_walk is not None
    assert db_walk.active is False
    assert db_walk.initiated_by_type == "patient"
    
    # 2. Locations linked correctly
    db_loc = db.query(Location).filter(Location.id == location_data["id"]).first()
    assert db_loc is not None
    assert db_loc.walk_id == walk_id
    assert db_loc.latitude == 41.3851
    assert len(db_walk.locations) == 1
    assert db_walk.locations[0].id == db_loc.id
