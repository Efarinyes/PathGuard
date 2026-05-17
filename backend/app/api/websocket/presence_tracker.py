from typing import Dict
from app.api.websocket.connection_manager import _patient_status_store, _patient_device_status_store


class PresenceTracker:
    @staticmethod
    def set_patient_online(group_id: int):
        _patient_status_store[group_id] = "online"

    @staticmethod
    def set_patient_offline(group_id: int):
        _patient_status_store[group_id] = "offline"

    @staticmethod
    def get_patient_status(group_id: int) -> str:
        return _patient_status_store.get(group_id, "offline")

    @staticmethod
    def update_device_status(group_id: int, battery_level: int | None, is_charging: bool | None):
        _patient_device_status_store[group_id] = {
            "battery_level": battery_level,
            "is_charging": is_charging,
        }

    @staticmethod
    def get_device_status(group_id: int) -> dict | None:
        return _patient_device_status_store.get(group_id)