from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from routes import user, chat

app = FastAPI(
    title="GPT API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-conversation-id"],
)

# create tables
Base.metadata.create_all(bind=engine)


# Health check endpoint (no authentication required)
@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "GPT API is running"}


app.include_router(user.router, prefix="/api/v1", tags=["user"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0", port=8000)
