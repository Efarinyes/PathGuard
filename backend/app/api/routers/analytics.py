from datetime import datetime, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import database as db_session
from app.db.models.walk import Walk
from app.api.users.models import User
from app.db.models.patient import Patient
from app.api.dependencies.auth import get_optional_patient, get_optional_caregiver, resolve_patient

router = APIRouter()

@router.get("/")
def get_analytics(
    db: Session = Depends(db_session.get_db),
    patient: Patient | None = Depends(get_optional_patient),
    user: User | None = Depends(get_optional_caregiver)
):
    """
    Returns basic analytics for caregiver dashboard.
    1. Average walk duration
    2. Most common walk start hours
    3. Walk frequency trend (recent activity)
    """
    # Authorize and resolve the patient for this caregiver
    active_patient = resolve_patient(patient, user)
    
    # Base query for finished walks of this patient
    walks = db.query(Walk).filter(
        Walk.patient_id == active_patient.id,
        Walk.active == False,
        Walk.end_time.isnot(None)
    ).all()
    
    if not walks:
        return {
            "avg_duration_minutes": 0,
            "common_start_hours": [],
            "walk_frequency": []
        }
    
    # 1. Average walk duration (in minutes)
    durations = [
        (w.end_time - w.start_time).total_seconds() / 60.0
        for w in walks
    ]
    avg_duration = sum(durations) / len(durations) if durations else 0
    
    # 2. Most common walk start hours
    hour_counts = {}
    for w in walks:
        hour = w.start_time.hour
        hour_counts[hour] = hour_counts.get(hour, 0) + 1
    
    # Sort by count descending and take top 3
    common_hours = sorted(
        [{"hour": h, "count": c} for h, c in hour_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:3]
    
    # 3. Walk frequency trend (last 7 days)
    # Using UTC now as baseline for stability
    today = datetime.utcnow().date()
    last_7_days = [(today - timedelta(days=i)) for i in range(6, -1, -1)]
    
    daily_counts = {day: 0 for day in last_7_days}
    for w in walks:
        walk_day = w.start_time.date()
        if walk_day in daily_counts:
            daily_counts[walk_day] += 1
            
    frequency_trend = [
        {"date": day.isoformat(), "count": count}
        for day, count in daily_counts.items()
    ]
    
    return {
        "avg_duration_minutes": round(avg_duration, 1),
        "common_start_hours": common_hours,
        "walk_frequency": frequency_trend
    }
