import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db.models.patient import Patient
from app.api.users.models import User
from app.api.ws_manager import manager
from uuid import uuid4

def test_websocket_device_status_update(
    client: TestClient, auth_headers: dict, db: Session,
    caregiver_user: User
) -> None:
    """
    Test that a device_status_update message from a patient is broadcast to caregivers.
    """
    jwt = auth_headers["Authorization"].split(" ")[1]
    
    # Ensure caregiver's group has a patient
    patient = db.query(Patient).filter(Patient.group_id == caregiver_user.group_id).first()
    if not patient:
        patient = Patient()
        patient.name = "WS Status Test Patient"
        patient.device_token = uuid4()
        patient.group_id = caregiver_user.group_id
        db.add(patient)
        db.commit()
        db.refresh(patient)

    patient_token = str(patient.device_token)
    
    # Clear manager rooms for a clean test state if needed, 
    # but manager is shared, so we just focus on our group.
    
    # 1. Caregiver connects
    with client.websocket_connect(f"/api/v1/ws/?token={jwt}") as caregiver_ws:
        caregiver_ws.receive_json()  # connection_established
        
        # 2. Patient connects
        with client.websocket_connect(f"/api/v1/ws/?patient_token={patient_token}") as patient_ws:
            patient_ws.receive_json()  # connection_established
            
            # Caregiver might receive watchers_update or patient_online here
            # We skip until we get device_status_update
            
            # 3. Patient sends device status update
            status_payload = {
                "type": "device_status_update",
                "battery_level": 88,
                "is_charging": True
            }
            patient_ws.send_json(status_payload)
            
            # 4. Caregiver receives the update
            # We loop because of potential other messages (watchers_update, online)
            received_status = False
            for _ in range(5): # Limit attempts
                update = caregiver_ws.receive_json()
                if update.get("type") == "device_status_update":
                    assert update["status"]["battery_level"] == 88
                    assert update["status"]["is_charging"] == True
                    assert "timestamp" in update["status"]
                    received_status = True
                    break
            
            assert received_status, "Caregiver did not receive device_status_update"

def test_websocket_snapshot_includes_battery(
    client: TestClient, auth_headers: dict, db: Session,
    caregiver_user: User
) -> None:
    """
    Test that the snapshot sent to a joining caregiver includes the latest device status.
    """
    jwt = auth_headers["Authorization"].split(" ")[1]
    
    # Get/Create patient
    patient = db.query(Patient).filter(Patient.group_id == caregiver_user.group_id).first()
    if not patient:
        patient = Patient()
        patient.name = "WS Snapshot Test Patient"
        patient.device_token = uuid4()
        patient.group_id = caregiver_user.group_id
        db.add(patient)
        db.commit()
        db.refresh(patient)

    patient_token = str(patient.device_token)
    group_id = caregiver_user.group_id
    
    # 1. Patient connects and sends status
    with client.websocket_connect(f"/api/v1/ws/?patient_token={patient_token}") as patient_ws:
        patient_ws.receive_json()
        patient_ws.send_json({
            "type": "device_status_update",
            "battery_level": 42,
            "is_charging": False
        })
        
        # 2. Caregiver connects
        with client.websocket_connect(f"/api/v1/ws/?token={jwt}") as caregiver_ws:
            caregiver_ws.receive_json() # connection_established
            
            # Snapshot should eventually arrive
            snapshot = None
            for _ in range(5):
                msg = caregiver_ws.receive_json()
                if msg.get("type") == "snapshot":
                    snapshot = msg
                    break
            
            assert snapshot is not None
            assert snapshot["device_status"]["battery_level"] == 42
            assert snapshot["device_status"]["is_charging"] == False
