# This file is used for model discovery by SQLAlchemy metadata (create_all) 
# and Alembic migrations. It avoids circular imports during startup.
from app.db.base.base_class import Base  # noqa
from app.api.users.models import User  # noqa
from app.api.models.walk import Walk  # noqa
from app.api.models.location import Location  # noqa
from app.api.models.patient import Patient  # noqa
