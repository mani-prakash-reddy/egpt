from typing import List, Dict, Optional, AsyncGenerator
from sqlalchemy.orm import Session
from database.db_models import Conversation, Message
from tools import web_search
from tools.information_retriever import (
    information_retriever,
    # search_query,
)
from uuid import uuid4
from pydantic import BaseModel, Field
from langchain.tools import Tool
from langchain_core.tools import tool
from .openai_provider import OpenAIProvider
from .embedding_provider import RAGService

llm_providers = {
    "E Gpt": OpenAIProvider,
}
tools = {
    "web_search": web_search,
    "information_retriever": information_retriever,
}


class ChatService:
    def __init__(self, llm_providers: dict = llm_providers):
        self.llm_providers = llm_providers
        self.tools = tools
        self._last_conversation_id = None  # Track last created conversation

    def get_available_models(self) -> dict:
        """Return a dictionary of available models for each provider"""
        available_models = {}
        for name, provider_class in self.llm_providers.items():
            try:
                provider_instance = provider_class()
                available_models[name] = provider_instance.get_available_models()
            except Exception as e:
                print(f"Warning: Could not get models for {name} provider: {e}")
                available_models[name] = []
        return available_models

    def get_available_tools(self) -> List[str]:
        """Return a list of available tools"""
        return list(self.tools.keys())

    def get_last_conversation_id(self) -> Optional[str]:
        """Return the last created conversation ID"""
        return self._last_conversation_id

    def generate_conversation_title(self, prompt: str) -> str:
        """Generate a meaningful conversation title from the first user message"""
        # Take first 50 characters and clean up
        title = prompt.strip()[:50]
        if len(prompt) > 50:
            title += "..."
        # Remove newlines and extra spaces
        title = " ".join(title.split())
        return title if title else "New Conversation"

    def parse_model_string(self, model_string: str) -> tuple[str, str]:
        """Parse model string format 'provider/model_name' into provider and model"""
        if "/" in model_string:
            provider, model = model_string.split("/", 1)
            return provider.strip(), model.strip()
        else:
            # Default to openai if no provider specified
            return "openai", model_string.strip()

    def get_provider_instance(
        self,
        provider_name: str,
        model_name: str,
        tool_names: Optional[List[str]] = None,
        conversation_id: Optional[str] = None,
    ):
        """Get the LLM provider instance with specified model and tools"""
        if provider_name not in self.llm_providers:
            raise ValueError(f"Provider '{provider_name}' is not supported.")

        # Get selected tools
        selected_tools = []
        if tool_names:
            for tool_name in tool_names:
                if tool_name == "information_retriever" and conversation_id:

                    @tool
                    def information_retriever(query: str) -> str:
                        """
                        Retrieve information based on the provided query from the documents uploaded in the current conversation.
                        This tool searches through documents that have been attached to the conversation.

                        Args:
                            query: The search query to retrieve information.
                        Returns:
                            The retrieved information as a string.
                        """
                        try:
                            rag_service = RAGService()
                            docs = rag_service.search_documents(
                                query, conversation_id, k=3
                            )

                            if not docs:
                                return "No relevant information found in the uploaded documents."

                            result = f"""<details closed>
    <summary>Documents search: `{query}`</summary>
                                """
                            for i, doc in enumerate(docs, 1):
                                result += f"\n{doc.page_content}\n\n"
                            result += "</details>"

                            return result
                        except Exception as e:
                            return f"Error retrieving information: {str(e)}"

                    # Create a tool with the wrapper function
                    retriever_tool = Tool(
                        name="information_retriever",
                        func=information_retriever,
                        description="Search for information in documents uploaded to this conversation",
                    )
                    selected_tools.append(retriever_tool)
                elif tool_name in self.tools:
                    selected_tools.append(self.tools[tool_name])
                else:
                    print(f"Warning: Tool '{tool_name}' not found")

        # Create provider instance with specified model and tools
        provider_class = self.llm_providers[provider_name]
        return provider_class(model_name=model_name, tools=selected_tools)

    def get_chat_history(
        self, db: Session, conversation_id: str
    ) -> List[Dict[str, str]]:
        """Retrieve chat history from database for a given conversation ID"""
        try:
            # Get conversation and verify it exists
            conversation = (
                db.query(Conversation)
                .filter(Conversation.id == conversation_id)
                .first()
            )
            if not conversation:
                return []

            # Get messages ordered by creation time
            messages = (
                db.query(Message)
                .filter(Message.conversation_id == conversation_id)
                .order_by(Message.created_at)
                .all()
            )

            # Convert to format expected by LLM providers
            history = []
            for message in messages:
                history.append({"role": message.role, "content": message.content})

            return history
        except Exception as e:
            print(f"Error retrieving chat history: {e}")
            return []

    def save_message(
        self, db: Session, conversation_id: str, role: str, content: str
    ) -> Message:
        """Save a message to the database"""
        try:
            message = Message(
                conversation_id=conversation_id, role=role, content=content
            )
            db.add(message)
            db.commit()
            db.refresh(message)
            return message
        except Exception as e:
            print(f"Error saving message: {e}")
            db.rollback()
            raise

    def create_conversation(
        self,
        db: Session,
        user_id: str,
        title: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> Conversation:
        """Create a new conversation with optional client-provided ID"""
        try:
            # Check if conversation with this ID already exists
            if conversation_id:
                existing_conversation = (
                    db.query(Conversation)
                    .filter(
                        Conversation.id == conversation_id,
                        Conversation.user_id == user_id,
                    )
                    .first()
                )

                if existing_conversation:
                    return existing_conversation

            # Get user to determine organization_id
            from database.db_models import User

            user = db.query(User).filter(User.id == user_id).first()
            organization_id = user.organization_id if user else None

            conversation = Conversation(
                id=conversation_id
                or str(uuid4()),  # Use provided ID or generate new one
                user_id=user_id,
                organization_id=organization_id,
                title=title or "New Conversation",
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            return conversation
        except Exception as e:
            print(f"Error creating conversation: {e}")
            db.rollback()
            raise

    def delete_conversation(
        self, db: Session, conversation_id: str, user_id: str
    ) -> bool:
        """Delete a conversation and all its messages. Returns True if successful, False if not found or access denied."""
        try:
            # Get conversation and verify it belongs to the user
            conversation = (
                db.query(Conversation)
                .filter(
                    Conversation.id == conversation_id, Conversation.user_id == user_id
                )
                .first()
            )

            if not conversation:
                return False

            # Delete all messages in the conversation first
            db.query(Message).filter(
                Message.conversation_id == conversation_id
            ).delete()

            # Delete the conversation
            db.delete(conversation)
            db.commit()

            return True
        except Exception as e:
            print(f"Error deleting conversation: {e}")
            db.rollback()
            raise

    def get_user_conversations(
        self, db: Session, user_id: str, limit: int = 50, offset: int = 0
    ) -> List[Dict]:
        """Get all conversations for a user with pagination"""
        try:
            conversations = (
                db.query(Conversation)
                .filter(Conversation.user_id == user_id)
                .order_by(Conversation.updated_at.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )

            result = []
            for conv in conversations:
                result.append(
                    {
                        "conversation_id": str(conv.id),
                        "title": conv.title,
                        "created_at": conv.created_at,
                        "updated_at": conv.updated_at,
                    }
                )

            return result
        except Exception as e:
            print(f"Error retrieving user conversations: {e}")
            return []

    async def generate_response_stream(
        self,
        db: Session,
        prompt: str,
        model_string: str,
        conversation_id: Optional[str] = None,
        tool_names: Optional[List[str]] = None,
        user_id: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response with conversation history and tool support"""
        try:
            # Parse model string
            provider_name, model_name = self.parse_model_string(model_string)

            # Get conversation history if conversation exists, or create conversation if ID provided
            conversation_history = []
            if conversation_id and user_id:
                # Get or create conversation with the provided ID
                conversation = self.create_conversation(
                    db, user_id=user_id, conversation_id=conversation_id
                )
                conversation_id = str(conversation.id)
                self._last_conversation_id = conversation_id
                conversation_history = self.get_chat_history(db, conversation_id)
            elif user_id and not conversation_id:
                # No ID provided but we have user_id - this shouldn't happen with new flow
                # but keeping as fallback
                title = self.generate_conversation_title(prompt)
                conversation = self.create_conversation(
                    db, user_id=user_id, title=title
                )
                conversation_id = str(conversation.id)
                self._last_conversation_id = conversation_id

            # Get provider instance with tools - pass conversation_id here
            provider = self.get_provider_instance(
                provider_name,
                model_name,
                tool_names,
                conversation_id,
            )

            # Save user message if conversation_id is available
            if conversation_id:
                self.save_message(db, conversation_id, "user", prompt)

            # Generate response stream
            full_response = ""
            async for chunk in provider.generate_response_stream(
                prompt=prompt,
                conversation_history=conversation_history,
                conversation_id=conversation_id,
            ):
                full_response += chunk
                yield chunk

            # Save assistant response if conversation_id is available and we have a response
            if conversation_id and full_response:
                self.save_message(db, conversation_id, "assistant", full_response)

        except Exception as e:
            error_msg = f"Error generating response: {str(e)}"
            print(error_msg)
            yield error_msg

    async def generate_response(
        self,
        db: Session,
        prompt: str,
        model_string: str,
        conversation_id: Optional[str] = None,
        tool_names: Optional[List[str]] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """Generate non-streaming response"""
        try:
            response_parts = []
            async for chunk in self.generate_response_stream(
                db, prompt, model_string, conversation_id, tool_names, user_id
            ):
                response_parts.append(chunk)
            return "".join(response_parts)
        except Exception as e:
            return f"Error generating response: {str(e)}"
