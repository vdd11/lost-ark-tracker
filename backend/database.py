import os

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
