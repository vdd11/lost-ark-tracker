import os
import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./database.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that opens a session per request and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_missing_columns():
    """Add columns that exist on the models but not yet in the database.

    create_all() only creates missing tables, so without this an existing
    database.db would break whenever a model gains a new column. New columns
    need a server_default so existing rows get a value. Returns the
    (table, column) pairs that were added, for one-off data upgrades.
    """
    inspector = inspect(engine)
    added = set()

    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue

            existing = {column["name"] for column in inspector.get_columns(table.name)}

            for column in table.columns:
                if column.name in existing:
                    continue

                column_type = column.type.compile(engine.dialect)
                statement = f"ALTER TABLE {table.name} ADD COLUMN {column.name} {column_type}"

                if column.server_default is not None:
                    statement += f" DEFAULT '{column.server_default.arg}'"

                connection.execute(text(statement))
                added.add((table.name, column.name))

    return added


BACKUPS_TO_KEEP = 10


def backup_database(today: date | None = None) -> Path | None:
    """Copy the database into a backups/ folder next to it, once per day.

    Runs at startup before any upgrade touches the data, so a bad migration
    or a mistaken restore can always be undone. Keeps the newest few copies.
    """
    if engine.url.get_backend_name() != "sqlite" or not engine.url.database:
        return None
    source = Path(engine.url.database)
    if not source.is_file() or source.stat().st_size == 0:
        return None

    folder = source.parent / "backups"
    folder.mkdir(exist_ok=True)
    target = folder / f"{source.stem}-{(today or date.today()).isoformat()}.db"
    if not target.exists():
        # SQLite's backup API copies a consistent snapshot even mid-write.
        # closing(): sqlite3's own context manager commits but doesn't close,
        # which leaves the files locked on Windows.
        with closing(sqlite3.connect(source)) as src, closing(sqlite3.connect(target)) as dst:
            src.backup(dst)

    for old in sorted(folder.glob(f"{source.stem}-*.db"))[:-BACKUPS_TO_KEEP]:
        old.unlink()
    return target
