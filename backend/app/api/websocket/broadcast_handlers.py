import logging

logger = logging.getLogger(__name__)


def setup_event_handlers(connection_manager):
    from app.api.websocket.event_publisher import event_publisher

    async def _broadcast_walk_started(data: dict):
        await connection_manager.broadcast_to_group(data["group_id"], {
            "type": "walk_started",
            "walk_id": data["walk_id"],
            "patient_id": data["patient_id"],
            "start_time": data["start_time"]
        })

    async def _broadcast_walk_stopped(data: dict):
        await connection_manager.broadcast_to_group(data["group_id"], {
            "type": "walk_stopped",
            "walk_id": data["walk_id"],
            "patient_id": data["patient_id"],
            "end_time": data["end_time"],
            "integrity": data["integrity"]
        })

    async def _broadcast_location(data: dict):
        await connection_manager.broadcast_to_group(data["group_id"], data)

    event_publisher.subscribe("walk_started", _broadcast_walk_started)
    event_publisher.subscribe("walk_stopped", _broadcast_walk_stopped)
    event_publisher.subscribe("location", _broadcast_location)