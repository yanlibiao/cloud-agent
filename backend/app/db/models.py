"""SQLAlchemy ORM models for persistent storage."""
import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    hashed_password = Column(String(256), nullable=False)
    display_name = Column(String(128), default="")
    created_at = Column(DateTime, server_default=func.now())

    sessions = relationship("DBSession", back_populates="user", cascade="all, delete-orphan")


class DBSession(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(256), default="New Session")
    status = Column(String(16), default="active")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="sessions")
    messages = relationship("DBMessage", back_populates="session", cascade="all, delete-orphan", order_by="DBMessage.created_at")


class DBMessage(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), ForeignKey("sessions.id"), nullable=False, index=True)
    role = Column(String(16), nullable=False)
    content = Column(Text, default="")
    tool_calls = Column(JSON, nullable=True)
    tool_call_id = Column(String(64), nullable=True)
    tool_name = Column(String(64), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    session = relationship("DBSession", back_populates="messages")
