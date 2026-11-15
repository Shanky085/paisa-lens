from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import dashboard, transactions
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app import models  # noqa: F401

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "Authorization"])
app.include_router(transactions.router, prefix=settings.api_v1_prefix)
app.include_router(dashboard.router, prefix=settings.api_v1_prefix)

@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": "paisa-lens-api"}
