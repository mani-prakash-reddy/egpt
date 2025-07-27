import uuid
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Text,
    ForeignKey,
    Boolean,
    Integer,
    JSON,
    LargeBinary,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .connection import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    users = relationship("User", back_populates="organization")
    documents = relationship("Document", back_populates="organization")
    conversations = relationship("Conversation", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    username = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    organization = relationship("Organization", back_populates="users")
    conversations = relationship("Conversation", back_populates="user")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    title = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="conversations")
    organization = relationship("Organization", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")
    tool_executions = relationship("ToolExecution", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String)
    file_type = Column(String)
    file_size = Column(Integer)
    content_type = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Optional - store file content directly in DB
    file_content = Column(LargeBinary)

    # Relationships
    organization = relationship("Organization", back_populates="documents")
    user = relationship("User")
    conversation_attachments = relationship(
        "ConversationAttachment", back_populates="document"
    )


class ConversationAttachment(Base):
    __tablename__ = "conversation_attachments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    conversation = relationship("Conversation")
    document = relationship("Document", back_populates="conversation_attachments")


class ToolExecution(Base):
    __tablename__ = "tool_executions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    message_id = Column(String, ForeignKey("messages.id"))
    tool_name = Column(String, nullable=False)
    input_data = Column(JSON)
    output_data = Column(JSON)
    status = Column(String)  # 'success', 'error', etc.
    error_message = Column(Text)
    execution_time = Column(Integer)  # in milliseconds
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="tool_executions")
    message = relationship("Message")
