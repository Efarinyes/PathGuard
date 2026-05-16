from collections import deque
from typing import Dict
from app.core.constants import MAX_LOCATION_HISTORY

class WalkStateCache:
    def __init__(self):
        self._cache: Dict[int, dict] = {}

    def update(self, walk_id: int, location_data: dict):
        if walk_id not in self._cache:
            self._cache[walk_id] = {"latest": None, "history": deque(maxlen=MAX_LOCATION_HISTORY)}

        self._cache[walk_id]["latest"] = location_data
        self._cache[walk_id]["history"].append(location_data)

    def get(self, walk_id: int):
        entry = self._cache.get(walk_id)
        if entry is None:
            return None
        return {
            "latest": entry["latest"],
            "history": list(entry["history"])
    }

    def clear(self, walk_id: int):
        if walk_id in self._cache:
            del self._cache[walk_id]

walk_state_cache = WalkStateCache()