from fastapi import FastAPI

app = FastAPI()

@app.get("/")

async def read_root():
    return {"message": "Lost Ark Tracker API is running!"}