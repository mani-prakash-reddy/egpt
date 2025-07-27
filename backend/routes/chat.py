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
async def get_available_models(
    current_user: User = Depends(get_current_active_user),
):
    """Get all available models from all providers"""
    return chat_service.get_available_models()


@router.get("/tools")
async def get_available_tools(
    current_user: User = Depends(get_current_active_user),
):
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


# @router.post("/chat", response_model=ChatResponse)
# async def chat(
#     request: ChatRequest,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_active_user),
# ):
#     """Non-streaming chat response"""
#     try:
#         # Use existing conversation or None (will be created when first message is saved)
#         conversation_id = request.conversation_id

#         response = await chat_service.generate_response(
#             db=db,
#             prompt=request.prompt,
#             model_string=request.model,
#             conversation_id=conversation_id,
#             tool_names=request.tools,
#             user_id=str(current_user.id),
#         )

#         # Get the actual conversation_id after potential creation
#         actual_conversation_id = chat_service.get_last_conversation_id()

#         return ChatResponse(
#             response=response,
#             conversation_id=actual_conversation_id or conversation_id,
#             model=request.model,
#             tools_used=request.tools,
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


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

@router.get("/conversations")
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

@router.delete("/conversations/{conversation_id}")
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
