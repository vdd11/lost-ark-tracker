from sqlalchemy.orm import Session

from models import Character, CharacterTask, Task

# A starting set of daily and weekly columns, only added when there are no
# tasks yet. Raids come from the catalog in raids.py.
DEFAULT_TASKS = [
    ("Chaos Dungeon", "daily"),
    ("Guardian Raid", "daily"),
]


# Rest bonus rules: (max, gained per skipped day, spent per rested run).
# Editable per task in Settings in case a patch changes them.
DEFAULT_REST_RULES = {
    "Chaos Dungeon": (200, 20, 40),
    "Guardian Raid": (100, 10, 20),
}


def apply_default_rest_rules(db: Session):
    """Give the default dailies their rest rules (new installs and upgrades)."""
    for name, (rest_max, rest_gain, rest_cost) in DEFAULT_REST_RULES.items():
        for task in db.query(Task).filter_by(name=name, category="daily", rest_max=0):
            task.rest_max, task.rest_gain, task.rest_cost = rest_max, rest_gain, rest_cost
    db.commit()


def seed_default_tasks(db: Session):
    if db.query(Task).first() is not None:
        return

    tasks = [
        Task(name=name, category=category, gold=0, position=position)
        for position, (name, category) in enumerate(DEFAULT_TASKS)
    ]
    db.add_all(tasks)
    db.flush()

    # Characters made before tasks existed get the dailies and weeklies too.
    for character in db.query(Character).all():
        for task in tasks:
            db.add(CharacterTask(character_id=character.id, task_id=task.id))

    db.commit()
    apply_default_rest_rules(db)
