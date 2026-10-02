from sqlalchemy.orm import Session

from models import Character, CharacterTask, Task

# A starting set of tracker columns, only added when there are no tasks yet.
# Raid gold is left at 0 on purpose: rewards change between patches, so set
# the current values (and add difficulties/gates) from the Settings page.
DEFAULT_TASKS = [
    ("Chaos Dungeon", "daily"),
    ("Guardian Raid", "daily"),
    ("Una's Dailies", "daily"),
    ("Una's Weeklies", "weekly"),
    ("Guild Weekly", "weekly"),
    ("Aegir", "raid"),
    ("Act 2: Brelshaza", "raid"),
    ("Act 3: Mordum", "raid"),
    ("Act 4: Armoche", "raid"),
    ("Final Act: Kazeros", "raid"),
]


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
            if task.category != "raid":
                db.add(CharacterTask(character_id=character.id, task_id=task.id))

    db.commit()
