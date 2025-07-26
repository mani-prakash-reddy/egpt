from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel

from database.connection import get_db
from services.chat_service import ChatService
from routes.user import get_current_active_user
from database.db_models import User

router = APIRouter()
chat_service = ChatService()


class ChatRequest(BaseModel):
    prompt: str
    model: str  # Format: "provider/model_name" e.g., "openai/gpt-4"
    conversation_id: Optional[str] = None
    tools: Optional[List[str]] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: Optional[str] = None
    model: str
    tools_used: Optional[List[str]] = None


@router.get("/models")
async def get_available_models():
    """Get all available models from all providers"""
    return chat_service.get_available_models()


@router.get("/tools")
async def get_available_tools():
    """Get all available tools"""
    return {"tools": chat_service.get_available_tools()}


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Stream chat response with conversation history and tool support"""
    try:
        # Create new conversation if none provided
        conversation_id = request.conversation_id
        if not conversation_id:
            conversation = chat_service.create_conversation(
                db, user_id=str(current_user.id), title=f"Chat with {request.model}"
            )
            conversation_id = str(conversation.id)

        return StreamingResponse(
            chat_service.generate_response_stream(
                db=db,
                prompt=request.prompt,
                model_string=request.model,
                conversation_id=conversation_id,
                tool_names=request.tools,
                user_id=str(current_user.id),
            ),
            media_type="text/plain",
            headers={"X-Conversation-ID": conversation_id},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Non-streaming chat response"""
    try:
        # Create new conversation if none provided
        conversation_id = request.conversation_id
        if not conversation_id:
            conversation = chat_service.create_conversation(
                db, user_id=str(current_user.id), title=f"Chat with {request.model}"
            )
            conversation_id = str(conversation.id)

        response = await chat_service.generate_response(
            db=db,
            prompt=request.prompt,
            model_string=request.model,
            conversation_id=conversation_id,
            tool_names=request.tools,
            user_id=str(current_user.id),
        )

        return ChatResponse(
            response=response,
            conversation_id=conversation_id,
            model=request.model,
            tools_used=request.tools,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}/history")
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


@router.post("/conversations")
async def create_conversation(
    title: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new conversation"""
    try:
        conversation = chat_service.create_conversation(
            db, user_id=str(current_user.id), title=title or "New Conversation"
        )
        return {
            "conversation_id": str(conversation.id),
            "title": conversation.title,
            "created_at": conversation.created_at,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
