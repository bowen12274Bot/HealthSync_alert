from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.core.config import settings
from app.core.database import SessionLocal, create_db_tables
from app.core.seed import seed_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.auto_create_tables:
        create_db_tables()

    if settings.auto_seed_demo_data:
        db = SessionLocal()
        try:
            seed_demo_data(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Backend service for the HealthSync smart health monitoring alert system.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://10.0.2.2",
        "http://10.0.2.2:5173",
        "capacitor://localhost",
        "ionic://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": f"{settings.app_name} is running."}


app.include_router(health_router)
app.include_router(auth_router)
