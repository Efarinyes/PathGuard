from app.api.websocket.connection_manager import connection_manager
from app.api.websocket.event_publisher import event_publisher

__all__ = ["connection_manager", "event_publisher"]


def setup_websocket_events():
    from app.api.websocket.broadcast_handlers import setup_event_handlers
    from app.api.websocket.connection_manager import connection_manager as cm
    setup_event_handlers(cm)