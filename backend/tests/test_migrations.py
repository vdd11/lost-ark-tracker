"""Table rebuilds and schema migrations, on a scratch database and scratch
tables (never the app's models or database)."""

from sqlalchemy import Column, ForeignKey, Integer, MetaData, String, Table, create_engine, inspect, text

from migrations import column_names, rebuild_table, run_schema_migrations
from models import AppliedMigration


def scratch_engine(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'scratch.db'}")
    AppliedMigration.__table__.create(engine)
    with engine.begin() as connection:
        # The "old" shape: `name` will become `label`, `size` text becomes an
        # integer, and `junk` goes away. `parts` points at `widgets`.
        connection.execute(text("CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT, size TEXT, junk TEXT)"))
        connection.execute(text("CREATE INDEX ix_widgets_name ON widgets (name)"))
        connection.execute(text("CREATE TABLE parts (id INTEGER PRIMARY KEY, widget_id INTEGER REFERENCES widgets (id))"))
        connection.execute(text("INSERT INTO widgets VALUES (1, 'Bolt', '12', 'x'), (2, 'Nut', '3', 'y')"))
        connection.execute(text("INSERT INTO parts VALUES (1, 2)"))
    return engine


def new_widgets():
    """The model's "new" shape."""
    metadata = MetaData()
    widgets = Table(
        "widgets",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("label", String(50), nullable=False, index=True),
        Column("size", Integer, nullable=False),
    )
    Table("parts", metadata, Column("id", Integer, primary_key=True), Column("widget_id", ForeignKey("widgets.id")))
    return widgets


def to_new_shape(row):
    return {"id": row["id"], "label": row["name"], "size": int(row["size"])}


def test_rebuild_renames_retypes_and_drops_columns_keeping_every_row(tmp_path):
    engine = scratch_engine(tmp_path)
    widgets = new_widgets()
    with engine.begin() as connection:
        rebuild_table(connection, widgets, to_new_shape)

    with engine.connect() as connection:
        assert column_names(connection, "widgets") == {"id", "label", "size"}
        rows = connection.execute(text("SELECT id, label, size, typeof(size) FROM widgets ORDER BY id")).all()
        assert [tuple(r) for r in rows] == [(1, "Bolt", 12, "integer"), (2, "Nut", 3, "integer")]
        inspector = inspect(connection)
        assert [i["name"] for i in inspector.get_indexes("widgets")] == ["ix_widgets_label"]
        assert set(inspector.get_table_names()) == {"applied_migrations", "widgets", "parts"}
        # Other tables still point at "widgets", not a temporary name.
        assert inspector.get_foreign_keys("parts")[0]["referred_table"] == "widgets"
    # The staging copy doesn't linger in the model's MetaData.
    assert set(widgets.metadata.tables) == {"widgets", "parts"}


def test_schema_migrations_run_once_and_skip_when_already_in_shape(tmp_path):
    engine = scratch_engine(tmp_path)
    widgets = new_widgets()
    calls = []

    def rename(connection):
        calls.append("rename")
        if "name" not in column_names(connection, "widgets"):
            return  # already the new shape (a fresh database)
        rebuild_table(connection, widgets, to_new_shape)

    migrations = [("widgets-label", rename)]
    assert run_schema_migrations(engine, migrations) == ["widgets-label"]
    assert run_schema_migrations(engine, migrations) == []
    assert calls == ["rename"]
    with engine.connect() as connection:
        assert connection.execute(text("SELECT name FROM applied_migrations")).scalars().all() == ["widgets-label"]

    # Already in shape: recorded, data untouched.
    fresh = create_engine(f"sqlite:///{tmp_path / 'fresh.db'}")
    AppliedMigration.__table__.create(fresh)
    widgets.metadata.create_all(fresh)
    assert run_schema_migrations(fresh, migrations) == ["widgets-label"]
    with fresh.connect() as connection:
        assert column_names(connection, "widgets") == {"id", "label", "size"}
