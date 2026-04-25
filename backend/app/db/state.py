from typing import Dict, List
from datetime import datetime

class WalkStateCache:
    """
    In-memory cache to store the latest state of active walks.
    Enables fast recovery for caregivers without repeated heavy DB queries.
    """
    def __init__(self):
        # key: walk_id, value: { "latest": dict, "history": list[dict] }
        self._cache: Dict[int, dict] = {}

    def update(self, walk_id: int, location_data: dict):
        if walk_id not in self._cache:
            self._cache[walk_id] = {"latest": None, "history": []}
        
        self._cache[walk_id]["latest"] = location_data
        
        history = self._cache[walk_id]["history"]
        history.append(location_data)
        
        # Keep only the last 50 points
        if len(history) > 50:
            history.pop(0)

    def get(self, walk_id: int):
        return self._cache.get(walk_id)

    def clear(self, walk_id: int):
        if walk_id in self._cache:
            del self._cache[walk_id]

# Global singleton instance
walk_state_cache = WalkStateCache()
