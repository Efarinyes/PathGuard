"""
Migration: extend location.client_id from VARCHAR(50) to VARCHAR(64)
for SHA-256 support (Sprint 1: deterministic client_id).
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.db.session.database import SessionLocal, engine
from app.core.config.settings import settings


def migrate():
    url = settings.DATABASE_URL
    print(f"Running migration on: {url.split('@')[-1] if '@' in url else url}")

    with engine.connect() as conn:
        if url.startswith("sqlite"):
            print("SQLite detected — recreating table...")
            conn.execute(text("PRAGMA foreign_keys=OFF;"))
            conn.execute(text("""
                CREATE TABLE location_new (
                    id INTEGER PRIMARY KEY,
                    walk_id INTEGER NOT NULL REFERENCES walk(id),
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    timestamp TEXT NOT NULL,
                    client_id TEXT UNIQUE,
                    is_recovered INTEGER DEFAULT 0
                );
            """))
            conn.execute(text("INSERT INTO location_new SELECT id, walk_id, latitude, longitude, timestamp, client_id, is_recovered FROM location;"))
            conn.execute(text("DROP TABLE location;"))
            conn.execute(text("ALTER TABLE location_new RENAME TO location;"))
            conn.execute(text("CREATE INDEX ix_location_client_id ON location(client_id);"))
            conn.execute(text("CREATE INDEX ix_location_id ON location(id);"))
            conn.execute(text("PRAGMA foreign_keys=ON;"))
            print("SQLite migration done.")
        else:
            print("PostgreSQL detected — altering column...")
            conn.execute(text("ALTER TABLE location ALTER COLUMN client_id TYPE VARCHAR(64);"))
            print("PostgreSQL migration done.")

        conn.commit()

    print("Migration complete.")


if __name__ == "__main__":
    migrate()
