import os
import dotenv
import uuid
from typing import Optional, Dict, List, AsyncGenerator

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, ToolMessage, AIMessage, SystemMessage
from openai import OpenAI

from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import InMemorySaver


class OpenAIProvider:
    def __init__(
        self,
        model_name: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        tools: Optional[List] = None,
    ):
        dotenv.load_dotenv()
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.api_base = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set.")
        self.model_name = model_name
        self.temperature = temperature
        self.tools = tools or []

        # Initialize LLM
        # Initialize LLM
        self.llm = ChatOpenAI(
            model=self.model_name,
            temperature=self.temperature,
            streaming=True,
            base_url=self.api_base,
            api_key=self.api_key,  # OpenAI client handles conversion to SecretStr # type: ignore
        )
        # Initialize LangGraph components
        self.init_graph()

    def get_available_models(self) -> List[str]:
        """Return a list of available models"""
        client = OpenAI(api_key=self.api_key, base_url=self.api_base)
        models = client.models.list()
        models_list = []
        for model in models:
            models_list.append(model.id)
        return models_list

    def init_graph(self):
        """Initialize LangGraph components"""
        # Create tool node for handling tool execution
        self.tool_node = ToolNode(self.tools) if self.tools else None

        # Define call_model function
        def call_model(state: MessagesState):
            llm_with_tools = self.llm.bind_tools(self.tools) if self.tools else self.llm
            response = llm_with_tools.invoke(state["messages"])
            return {"messages": [response]}

        # Create the graph
        builder = StateGraph(MessagesState)
        builder.add_node("agent", call_model)

        if self.tool_node:
            builder.add_node("tools", self.tool_node)

            # Define routing logic
            # Define routing logic
            def should_continue(state: MessagesState):
                last_message = state["messages"][-1]
                # Check if it's an AIMessage and has additional_kwargs with tool_calls
                if isinstance(
                    last_message, AIMessage
                ) and last_message.additional_kwargs.get("tool_calls"):
                    return "tools"
                return "end"

            builder.add_conditional_edges(
                "agent", should_continue, {"tools": "tools", "end": END}
            )
            builder.add_edge("tools", "agent")
        else:
            builder.add_edge("agent", END)

        builder.add_edge(START, "agent")

        # Compile the graph with checkpointer for persistence
        self.checkpointer = InMemorySaver()
        self.graph = builder.compile(checkpointer=self.checkpointer)

    def get_fallback_response(self):
        return "Systems are currently offline. Please try again later."

    async def generate_response_stream(
        self,
        prompt: str,
        conversation_history: Optional[List[Dict]] = None,
        conversation_id: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream response with tool handling using LangGraph"""
        try:
            # Create or use thread_id for persistence
            thread_id = conversation_id or str(uuid.uuid4())
            config = {"configurable": {"thread_id": thread_id}}
            # Prepare messages
            system_prompt = "You are a helpful assistant. Please provide accurate and concise responses."
            messages = []
            messages.append(SystemMessage(content=system_prompt))

            # Add conversation history
            if conversation_history:
                for msg in conversation_history:
                    if msg["role"] == "user":
                        messages.append(HumanMessage(content=msg["content"]))
                    elif msg["role"] == "assistant":
                        messages.append(AIMessage(content=msg["content"]))
                    elif msg["role"] == "tool":
                        messages.append(
                            ToolMessage(
                                content=msg["content"],
                                tool_call_id=msg.get("tool_call_id", ""),
                            )
                        )

            # Add the current prompt
            messages.append(HumanMessage(content=prompt))
            # Create proper state object for LangGraph
            state = {"messages": messages}

            # Stream from the graph
            async for chunk in self.graph.astream(
                state,
                config=config, # type: ignore
                stream_mode="values",  # Stream token-by-token messages
            ):
                # Process the chunk to extract just the text content
                if isinstance(chunk, dict) and "messages" in chunk:
                    # This handles full message updates
                    yield chunk["messages"][-1].content
                elif isinstance(chunk, AIMessage) and hasattr(chunk, "content"):
                    # This handles token-by-token streaming
                    yield chunk.content
                    # This handles token-by-token streaming
                    yield chunk.content # type: ignore

        except Exception as e:
            print(f"Error in streaming response: {e}")
            yield self.get_fallback_response()

    async def generate_response(
        self,
        prompt: str,
        conversation_history: Optional[List[Dict]] = None,
        conversation_id: Optional[str] = None,
    ) -> str:
        """Non-streaming response (collects all chunks)"""
        try:
            response_parts = []
            async for chunk in self.generate_response_stream(
                prompt, conversation_history, conversation_id
            ):
                response_parts.append(chunk)
            return "".join(response_parts)
        except Exception as e:
            print(f"Error generating response: {e}")
            return self.get_fallback_response()
