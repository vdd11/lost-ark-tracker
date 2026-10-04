"""Database changes beyond adding columns.

What to use (see also CLAUDE.md, "Changing the database"):

- New column: give it a server_default; add_missing_columns() adds it.
- New table: create_all() makes it (and add it to backups.BACKUP_MODELS).
- Fill in or fix data: run_once(db, "name", fn) in main.py's startup.
- Rename a column, change its type, or drop one: a table rebuild here, listed
  in SCHEMA_MIGRATIONS. These run before add_missing_columns(), so the model
  can already use the new shape. For example, renaming characters.name:

      def rename_character_name(connection):
          if "name" not in column_names(connection, "characters"):
              return  # a new database already has the new shape
          rebuild_table(connection, Character.__table__,
                        lambda row: {**row, "display_name": row["name"]})

      SCHEMA_MIGRATIONS = [("characters-display-name", rename_character_name)]

  Such a change also needs a backup format step (backups.py). Never edit a
  migration that has shipped; add a new one.
"""

from collections.abc import Callable
from datetime import datetime, timezone

from sqlalchemy import Connection, Engine, Table, inspect, text
from sqlalchemy.orm import Session

from models import AppliedMigration

SchemaMigration = Callable[[Connection], None]

# Applied in order, each once per database. Empty until a change needs one.
SCHEMA_MIGRATIONS: list[tuple[str, SchemaMigration]] = []


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def run_once(db: Session, name: str, upgrade):
    """Run a one-off data upgrade unless it already ran on this database."""
    if db.get(AppliedMigration, name) is not None:
        return
    upgrade(db)
    db.add(AppliedMigration(name=name, applied_at=_now()))
    db.commit()


def column_names(connection: Connection, table: str) -> set[str]:
    return {column["name"] for column in inspect(connection).get_columns(table)}


def rebuild_table(connection: Connection, table: Table, transform: Callable[[dict], dict]):
    """Rebuild a table into the shape its model now has, copying every row
    through `transform` (old row dict -> new row dict; keys the new table
    doesn't have are dropped).

    SQLite can't change a column's name or type in place for every version we
    ship with, so this follows its recommended steps: build the new table
    under a temporary name, copy, drop the old one, rename the new one into
    place. Renaming last keeps other tables' foreign keys pointing at the
    right name. Indexes are recreated from the model.
    """
    name = table.name
    temporary = f"{name}__new"
    rows = [dict(row._mapping) for row in connection.execute(text(f'SELECT * FROM "{name}"'))]

    # Index names are global in SQLite: drop the old ones before creating the new.
    old_indexes = connection.execute(
        text("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = :table AND sql IS NOT NULL"),
        {"table": name},
    ).scalars().all()
    for index in old_indexes:
        connection.execute(text(f'DROP INDEX "{index}"'))

    # A copy of the table under the temporary name, in the same MetaData so
    # its foreign keys resolve, and without indexes (they'd be named after the
    # temporary table); removed again right after.
    staging = table.to_metadata(table.metadata, name=temporary)
    staging.indexes.clear()
    try:
        staging.create(connection)
        columns = {column.name for column in staging.columns}
        new_rows = [{key: value for key, value in transform(dict(row)).items() if key in columns} for row in rows]
        if new_rows:
            connection.execute(staging.insert(), new_rows)
    finally:
        table.metadata.remove(staging)

    connection.execute(text(f'DROP TABLE "{name}"'))
    connection.execute(text(f'ALTER TABLE "{temporary}" RENAME TO "{name}"'))
    for index in table.indexes:
        index.create(connection)


def run_schema_migrations(engine: Engine, migrations: list[tuple[str, SchemaMigration]] | None = None) -> list[str]:
    """Apply pending table rebuilds, each in its own transaction, and record
    them. Returns the names applied this time."""
    applied = []
    for name, migration in SCHEMA_MIGRATIONS if migrations is None else migrations:
        with engine.begin() as connection:
            done = connection.execute(
                text("SELECT 1 FROM applied_migrations WHERE name = :name"), {"name": name}
            ).first()
            if done:
                continue
            migration(connection)
            connection.execute(
                AppliedMigration.__table__.insert(), {"name": name, "applied_at": _now()}
            )
            applied.append(name)
    return applied
