from typing import List, Dict, Optional, AsyncGenerator
from sqlalchemy.orm import Session
from database.db_models import Conversation, Message
from tools import web_search

from .ollama_provider import OllamaProvider
from .openai_provider import OpenAIProvider

llm_providers = {
    "openai": OpenAIProvider,
    "ollama": OllamaProvider,
}
tools = {
    "web_search": web_search,
}


class ChatService:
    def __init__(self, llm_providers: dict = llm_providers):
        self.llm_providers = llm_providers
        self.tools = tools
        self.available_models = {}
        # Initialize available models for each provider
        for name, provider_class in llm_providers.items():
            try:
                temp_provider = provider_class()
                self.available_models[name] = temp_provider.get_available_models()
            except Exception as e:
                print(f"Warning: Could not initialize {name} provider: {e}")
                self.available_models[name] = []

    def get_available_models(self) -> dict:
        """Return a dictionary of available models for each provider"""
        return self.available_models

    def get_available_tools(self) -> List[str]:
        """Return a list of available tools"""
        return list(self.tools.keys())

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
    ):
        """Get the LLM provider instance with specified model and tools"""
        if provider_name not in self.llm_providers:
            raise ValueError(f"Provider '{provider_name}' is not supported.")

        # Get selected tools
        selected_tools = []
        if tool_names:
            for tool_name in tool_names:
                if tool_name in self.tools:
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
        self, db: Session, user_id: str, title: Optional[str] = None
    ) -> Conversation:
        """Create a new conversation"""
        try:
            conversation = Conversation(
                user_id=user_id,
                organization_id=None,  # You may want to set this based on user's organization
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

            # Get provider instance with tools
            provider = self.get_provider_instance(provider_name, model_name, tool_names)

            # Get conversation history
            conversation_history = []
            if conversation_id:
                conversation_history = self.get_chat_history(db, conversation_id)

            # Save user message if conversation_id provided
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

            # Save assistant response if conversation_id provided
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
