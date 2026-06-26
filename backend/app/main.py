"""FastAPI application entry point."""
import logging
import os
import shutil
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.db.database import init_db
from app.sandbox.manager import sandbox_manager
from app.ws.handler import ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up cloud-agent backend...")
    logger.info(f"LLM model: {settings.llm_model}")
    logger.info(f"Sandbox image: {settings.sandbox_image}")
    logger.info(f"Sandbox image: {settings.sandbox_image}")

    # Ensure .env exists (fallback to .env.example for Codespace)
    env_path = Path(".env")
    env_example = Path("../.env.example")
    if not env_path.exists() and env_example.exists():
        shutil.copy(env_example, env_path)
        logger.info("Created .env from .env.example")

    # Init DB
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.warning(f"DB init skipped (will use in-memory): {e}")

    # Init sandbox manager
    try:
        await sandbox_manager.initialize()
        logger.info("Sandbox manager initialized")
    except Exception as e:
        logger.warning(f"Sandbox init skipped (Docker might not be available): {e}")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await sandbox_manager.shutdown()


app = FastAPI(
    title="无穷Agent",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: allow all origins for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(api_router, prefix="/api")
app.include_router(ws_router)
