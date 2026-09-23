from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine, SessionLocal
from models import Character
from schemas import CharacterCreate

app = FastAPI()

# Allow the Next.js frontend to communicate with our API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create the database tables when the application starts.
Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "Lost Ark Tracker API is running!"}

@app.post("/characters")
def create_character(character_data: CharacterCreate):
    db = SessionLocal()

    character = Character(
        name=character_data.name,
        class_name=character_data.class_name
    )

    db.add(character)
    db.commit()
    db.refresh(character)

    db.close()

    return character
@app.get("/characters")
def get_characters():
    db = SessionLocal()

    characters = db.query(Character).all()

    db.close()

    return characters
@app.delete("/characters/{character_id}")
def delete_character(character_id: int):
    db = SessionLocal()

    character = db.query(Character).filter(Character.id == character_id).first()

    if character is None:
        db.close()
        return {"message": "Character not found"}

    db.delete(character)
    db.commit()
    db.close()

    return {"message": "Character deleted"}