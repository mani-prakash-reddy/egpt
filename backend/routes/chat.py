from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel, Field

from database.connection import get_db
from services.chat_service import ChatService
from routes.user import get_current_active_user
from database.db_models import User

router = APIRouter()
chat_service = ChatService()


class ChatRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="The user's message or question to send to the AI model",
        examples=["What is the capital of France?"],
    )
    model: str = Field(
        ...,
        description="AI model to use in format 'provider/model_name'",
        examples=["openai/gpt-4"],
    )
    conversation_id: Optional[str] = Field(
        None,
        description="ID of existing conversation to continue, or null for new conversation",
        examples=["123e4567-e89b-12d3-a456-426614174000"],
    )
    tools: Optional[List[str]] = Field(
        None,
        description="List of tool names to make available to the AI",
        examples=[["web_search", "calculator"]],
    )

    class Config:
        json_schema_extra = {
            "example": {
                "prompt": "What is the capital of France?",
                "model": "openai/gpt-4",
                "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
                "tools": ["web_search", "calculator"],
            }
        }


class ChatResponse(BaseModel):
    response: str = Field(
        ...,
        description="The AI model's response to the user's prompt",
        examples=["The capital of France is Paris."],
    )
    conversation_id: Optional[str] = Field(
        None,
        description="ID of the conversation this response belongs to",
        examples=["123e4567-e89b-12d3-a456-426614174000"],
    )
    model: str = Field(
        ...,
        description="The AI model that generated this response",
        examples=["openai/gpt-4"],
    )
    tools_used: Optional[List[str]] = Field(
        None,
        description="List of tools that were used to generate this response",
        examples=[["web_search"]],
    )

    class Config:
        json_schema_extra = {
            "example": {
                "response": "The capital of France is Paris.",
                "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
                "model": "openai/gpt-4",
                "tools_used": ["web_search"],
            }
        }


class ModelInfo(BaseModel):
    provider: str = Field(..., description="AI provider name", examples=["openai"])
    model_name: str = Field(..., description="Model identifier", examples=["gpt-4"])
    display_name: str = Field(
        ..., description="Human-readable model name", examples=["GPT-4"]
    )
    description: str = Field(
        ..., description="Model description", examples=["Most capable GPT-4 model"]
    )

    class Config:
        json_schema_extra = {
            "example": {
                "provider": "openai",
                "model_name": "gpt-4",
                "display_name": "GPT-4",
                "description": "Most capable GPT-4 model",
            }
        }


class ConversationInfo(BaseModel):
    id: str = Field(
        ...,
        description="Conversation ID",
        examples=["123e4567-e89b-12d3-a456-426614174000"],
    )
    title: str = Field(
        ..., description="Conversation title", examples=["Discussion about France"]
    )
    created_at: str = Field(
        ..., description="Creation timestamp", examples=["2025-08-02T10:30:00Z"]
    )
    updated_at: str = Field(
        ..., description="Last update timestamp", examples=["2025-08-02T10:35:00Z"]
    )
    message_count: int = Field(
        ..., description="Number of messages in conversation", examples=[4]
    )

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "title": "Discussion about France",
                "created_at": "2025-08-02T10:30:00Z",
                "updated_at": "2025-08-02T10:35:00Z",
                "message_count": 4,
            }
        }


class MessageInfo(BaseModel):
    id: str = Field(..., description="Message ID", examples=["msg-123"])
    role: str = Field(..., description="Message role", examples=["user"])
    content: str = Field(
        ..., description="Message content", examples=["What is the capital of France?"]
    )
    timestamp: str = Field(
        ..., description="Message timestamp", examples=["2025-08-02T10:30:00Z"]
    )
    model: Optional[str] = Field(
        None, description="Model used for assistant messages", examples=["openai/gpt-4"]
    )

    class Config:
        json_schema_extra = {
            "example": {
                "id": "msg-123",
                "role": "user",
                "content": "What is the capital of France?",
                "timestamp": "2025-08-02T10:30:00Z",
                "model": "openai/gpt-4",
            }
        }


@router.get(
    "/models",
    summary="Get available AI models",
    description="Retrieve all available AI models from all configured providers",
    responses={
        200: {
            "description": "List of available models",
            "content": {
                "application/json": {
                    "example": {
                        "models": [
                            {
                                "provider": "openai",
                                "model_name": "gpt-4",
                                "display_name": "GPT-4",
                                "description": "Most capable GPT-4 model",
                            },
                            {
                                "provider": "anthropic",
                                "model_name": "claude-3-sonnet",
                                "display_name": "Claude 3 Sonnet",
                                "description": "Balanced model for most tasks",
                            },
                        ]
                    }
                }
            },
        }
    },
)
async def get_available_models(
    current_user: User = Depends(get_current_active_user),
):
    """Get all available models from all providers"""
    return chat_service.get_available_models()


@router.get(
    "/tools",
    summary="Get available tools",
    description="Retrieve all available tools that can be used with AI models",
    responses={
        200: {
            "description": "List of available tools",
            "content": {
                "application/json": {
                    "example": {
                        "tools": [
                            "web_search",
                            "calculator",
                            "code_interpreter",
                            "file_reader",
                        ]
                    }
                }
            },
        }
    },
)
async def get_available_tools(
    current_user: User = Depends(get_current_active_user),
):
    """Get all available tools"""
    return {"tools": chat_service.get_available_tools()}


@router.post(
    "/chat/stream",
    summary="Stream chat response",
    description="Send a message to an AI model and receive a streaming response. Supports conversation history and tool usage.",
    responses={
        200: {
            "description": "Streaming response from AI model",
            "content": {
                "text/stream": {
                    "example": "The capital of France is Paris. It has been the capital since..."
                }
            },
            "headers": {
                "X-Conversation-ID": {
                    "description": "ID of the conversation",
                    "schema": {
                        "type": "string",
                        "example": "123e4567-e89b-12d3-a456-426614174000",
                    },
                }
            },
        },
        400: {
            "description": "Invalid request parameters",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Invalid model format. Use 'provider/model_name'"
                    }
                }
            },
        },
        500: {
            "description": "Internal server error",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to generate response"}
                }
            },
        },
    },
)
async def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Stream chat response with conversation history and tool support"""
    try:
        # Use existing conversation or None (will be created when first message is saved)
        conversation_id = request.conversation_id

        async def generate_with_headers():
            async for chunk in chat_service.generate_response_stream(
                db=db,
                prompt=request.prompt,
                model_string=request.model,
                conversation_id=conversation_id,
                tool_names=request.tools,
                user_id=str(current_user.id),
            ):
                yield chunk

        # Get the conversation ID after potential creation
        final_conversation_id = (
            conversation_id or chat_service.get_last_conversation_id() or "none"
        )

        return StreamingResponse(
            generate_with_headers(),
            media_type="text/stream",
            headers={"X-Conversation-ID": final_conversation_id},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/conversations/{conversation_id}/history",
    summary="Get conversation history",
    description="Retrieve the complete message history for a specific conversation",
    responses={
        200: {
            "description": "Conversation history retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
                        "history": [
                            {
                                "id": "msg-1",
                                "role": "user",
                                "content": "What is the capital of France?",
                                "timestamp": "2025-08-02T10:30:00Z",
                            },
                            {
                                "id": "msg-2",
                                "role": "assistant",
                                "content": "The capital of France is Paris.",
                                "timestamp": "2025-08-02T10:30:05Z",
                                "model": "openai/gpt-4",
                            },
                        ],
                    }
                }
            },
        },
        404: {
            "description": "Conversation not found",
            "content": {
                "application/json": {"example": {"detail": "Conversation not found"}}
            },
        },
    },
)
async def get_conversation_history(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get conversation history"""
    try:
        history = chat_service.get_chat_history(db, conversation_id)
        return {"conversation_id": conversation_id, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/conversations",
    summary="Get user conversations",
    description="Retrieve all conversations for the current user with pagination support",
    responses={
        200: {
            "description": "User conversations retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "conversations": [
                            {
                                "id": "123e4567-e89b-12d3-a456-426614174000",
                                "title": "Discussion about France",
                                "created_at": "2025-08-02T10:30:00Z",
                                "updated_at": "2025-08-02T10:35:00Z",
                                "message_count": 4,
                            },
                            {
                                "id": "456e7890-e89b-12d3-a456-426614174001",
                                "title": "Python programming help",
                                "created_at": "2025-08-01T15:20:00Z",
                                "updated_at": "2025-08-01T15:45:00Z",
                                "message_count": 8,
                            },
                        ],
                        "total": 2,
                        "limit": 50,
                        "offset": 0,
                    }
                }
            },
        }
    },
)
async def get_user_conversations(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get all conversations for the current user"""
    try:
        conversations = chat_service.get_user_conversations(
            db, user_id=str(current_user.id), limit=limit, offset=offset
        )
        return {
            "conversations": conversations,
            "total": len(conversations),
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/conversations/{conversation_id}",
    summary="Delete conversation",
    description="Delete a conversation and all its messages. Only the conversation owner can delete it.",
    responses={
        200: {
            "description": "Conversation deleted successfully",
            "content": {
                "application/json": {
                    "example": {
                        "message": "Conversation deleted successfully",
                        "conversation_id": "123e4567-e89b-12d3-a456-426614174000",
                    }
                }
            },
        },
        404: {
            "description": "Conversation not found or access denied",
            "content": {
                "application/json": {
                    "example": {"detail": "Conversation not found or access denied"}
                }
            },
        },
        500: {
            "description": "Internal server error",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to delete conversation"}
                }
            },
        },
    },
)
async def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a conversation and all its messages"""
    try:
        result = chat_service.delete_conversation(
            db, conversation_id=conversation_id, user_id=str(current_user.id)
        )
        if result:
            return {
                "message": "Conversation deleted successfully",
                "conversation_id": conversation_id,
            }
        else:
            raise HTTPException(
                status_code=404, detail="Conversation not found or access denied"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
