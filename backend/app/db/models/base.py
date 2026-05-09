# This file is used for model discovery by SQLAlchemy metadata (create_all)
# and Alembic migrations. It avoids circular imports during startup.
from app.db.base.base_class import Base  # noqa
import app.db.models  # noqa — imports all models including User
