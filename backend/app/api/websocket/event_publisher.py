import uuid
import logging
from typing import Dict, List, Callable, Awaitable, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

EventHandler = Callable[[dict], Awaitable[None]]


class EventPublisher:
    def __init__(self):
        self._handlers: Dict[str, List[EventHandler]] = {}

    def subscribe(self, event_name: str, handler: EventHandler):
        if event_name not in self._handlers:
            self._handlers[event_name] = []
        self._handlers[event_name].append(handler)
        logger.debug("Subscribed handler for event '%s'", event_name)

    def unsubscribe(self, event_name: str, handler: EventHandler):
        if event_name in self._handlers:
            self._handlers[event_name].remove(handler)

    async def publish(self, event_name: str, data: dict):
        if event_name not in self._handlers:
            return

        data["_event_name"] = event_name
        data["_event_id"] = str(uuid.uuid4())
        data["_timestamp"] = datetime.now(timezone.utc).isoformat()

        for handler in self._handlers[event_name]:
            try:
                await handler(data)
            except Exception as e:
                logger.error("Event handler error for '%s': %s", event_name, str(e))


event_publisher = EventPublisher()