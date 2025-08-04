import os
import dotenv
from typing import Optional, Dict, List, TypedDict, Annotated, Literal, AsyncGenerator, Union
from operator import add

# LangChain imports
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, ToolMessage, AIMessage, SystemMessage
from openai import OpenAI

# LangGraph imports
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import Command


class ChatState(MessagesState):
    tool_calls: Optional[List] = None
    results: Optional[Dict[str, str]] = None


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
        self.system_prompt = "You are a helpful assistant. Please provide accurate and concise responses."
        
        # Initialize LLM - no tool binding
        self.llm = ChatOpenAI(
            model=self.model_name,
            temperature=self.temperature,
            streaming=True,
            base_url=self.api_base,
            api_key=self.api_key,
        )
        
        # Build the graph
        self.graph = self._build_graph()
    
    def get_available_models(self) -> List[str]:
        """Return a list of available models"""
        client = OpenAI(api_key=self.api_key, base_url=self.api_base)
        models = client.models.list()
        models_list = []
        for model in models:
            models_list.append(model.id)
        return models_list
    
    def get_fallback_response(self):
        return "Systems are currently offline. Please try again later."
    
    def _build_graph(self):
        # Define the nodes in our graph
        builder = StateGraph(ChatState)
        
        # Add nodes to the graph
        builder.add_node("call_model", self._call_model)
        
        # If tools are provided, use LangGraph's ToolNode
        if self.tools:
            # Create a ToolNode with the tools
            tool_node = ToolNode(self.tools)
            builder.add_node("tools", tool_node)
            
            # Add conditional edges for the flow
            builder.add_conditional_edges(
                "call_model",
                self._should_continue,
                {
                    "tools": "tools",
                    "end": END
                }
            )
            
            # Add edge from tools back to model for final response
            builder.add_edge("tools", "call_model")
        else:
            # If no tools, just go from model to end
            builder.add_edge("call_model", END)
            
        # Set the entry point to the model
        builder.add_edge(START, "call_model")
        
        # Compile the graph
        return builder.compile()

    def _call_model(self, state: ChatState) -> Dict:
        """Call the LLM and handle the response"""
        # Get the messages from the state
        messages = state.get("messages", [])
        
        # Add system message if it's not present
        if not any(isinstance(msg, SystemMessage) for msg in messages):
            messages = [SystemMessage(content=self.system_prompt)] + messages
        
        # Call the LLM (no need for llm_with_tools anymore)
        response = self.llm.invoke(messages)
        
        # Store tool calls if present
        tool_calls = getattr(response, "tool_calls", None)
        if not tool_calls and hasattr(response, "additional_kwargs"):
            tool_calls = response.additional_kwargs.get("tool_calls", [])
            
        if tool_calls:
            return {
                "messages": [response],
                "tool_calls": tool_calls
            }
        else:
            return {"messages": [response]}

    def _should_continue(self, state: ChatState) -> Literal["tools", "end"]:
        """Determine if we should execute tools or end the conversation"""
        tool_calls = state.get("tool_calls", [])
        if tool_calls:
            return "tools"
        return "end"

    async def generate_response_stream(
        self,
        prompt: str,
        conversation_history: Optional[List[Dict]] = None,
        conversation_id: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream response with tool handling"""
        try:
            # Prepare messages
            messages = []
            
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
            
            # Add the new user message
            messages.append(HumanMessage(content=prompt))
            
            # Configure thread ID for persistence
            config = {
                "configurable": {
                    "thread_id": conversation_id or "default"
                }
            }
            
            # Initial state for the graph
            initial_state = {"messages": messages}
            
            # Stream response chunks
            full_response = ""
            tool_results_sent = set()
            
            async for event in self.graph.astream(
                initial_state,
                config=config,
                stream_mode="values"
            ):
                # Check for node name and update type
                if isinstance(event, tuple) and len(event) == 2:
                    node_name, update = event
                    
                    # If this is from the tools node
                    if node_name and "tools" in node_name:
                        # Get the tool results
                        tool_messages = update.get("messages", [])
                        for msg in tool_messages:
                            if isinstance(msg, ToolMessage):
                                tool_call_id = getattr(msg, "tool_call_id", "")
                                content = getattr(msg, "content", "")
                                
                                # Extract tool name from messages or state
                                tool_name = "Tool"  # Default name
                                for tc in state.get("tool_calls", []):
                                    if (hasattr(tc, "id") and tc.id == tool_call_id) or \
                                       (isinstance(tc, dict) and tc.get("id") == tool_call_id):
                                        tool_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", "Tool")
                                        break
                                
                                if tool_call_id not in tool_results_sent:
                                    yield f"\n\n🔧 **Tool Used:** {tool_name}\n**Result:** {content}\n\n"
                                    tool_results_sent.add(tool_call_id)
                        
                        # After tools, let client know we'll provide a final response
                        if tool_messages and node_name.endswith("tools"):
                            yield "\n**Final Response:**\n"
                    
                    # If this is from the call_model node, stream the content
                    elif node_name and "call_model" in node_name:
                        # Get the latest message
                        messages = update.get("messages", [])
                        if messages and len(messages) > 0:
                            latest_msg = messages[-1]
                            if hasattr(latest_msg, "content") and latest_msg.content:
                                content = latest_msg.content
                                # Only yield new content
                                if len(content) > len(full_response):
                                    new_content = content[len(full_response):]
                                    full_response = content
                                    yield new_content
                
                # Handle direct streaming content from LLM
                elif hasattr(event, "content") and event.content:
                    content = event.content
                    if len(content) > len(full_response):
                        new_content = content[len(full_response):]
                        full_response = content
                        yield new_content

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