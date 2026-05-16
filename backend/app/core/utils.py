from datetime import datetime, timezone

def format_timestamp_utc(dt: datetime) -> str:
    if dt is None:
        return None
    iso = dt.isoformat()
    if iso.endswith("+00:00"):
        return iso.replace("+00:00", "Z")
    if not iso.endswith("Z"):
        return iso + "Z"
    return iso