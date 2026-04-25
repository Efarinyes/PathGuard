# This file is used for model discovery by SQLAlchemy metadata (create_all) 
# and Alembic migrations. It avoids circular imports during startup.
from app.db.base.base_class import Base  # noqa
from app.api.users.models import User  # noqa
from app.db.models.walk import Walk  # noqa
from app.db.models.location import Location  # noqa
from app.db.models.patient import Patient  # noqa
