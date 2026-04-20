"""
init_db.py
Initializes the SQLite database and creates all tables.
Run once before starting the server:
    python init_db.py
"""
from app.db.session.database import engine
import app.db.base_models  # noqa: F401 — registers all models on Base.metadata

from app.db.base.base_class import Base

print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Done. Tables created:")
from sqlalchemy import inspect
for table in inspect(engine).get_table_names():
    print(f"  - {table}")
