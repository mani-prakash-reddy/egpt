import os
import dotenv
from typing import Optional, Dict, List, AsyncGenerator
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, ToolMessage, AIMessage, SystemMessage
import json


class OpenAIProvider:
    def __init__(
        self,
        model_name: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        tools: Optional[List] = None,
    ):
        dotenv.load_dotenv()
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set.")
        self.model_name = model_name
        self.temperature = temperature
        self.tools = tools or []
        self.llm = ChatOpenAI(
            model=self.model_name,
            temperature=self.temperature,
            streaming=True,  # Enable streaming
        )
        self.init_tools()
    def get_available_models(self) -> List[str]:
        """Return a list of available models"""
        return [
			"gpt-3.5-turbo",
			"gpt-4",
			"gpt-4o-mini",
			"gpt-4o",
		]

    def init_tools(self):
        if self.tools and self.llm:
            try:
                self.llm_with_tools = self.llm.bind_tools(self.tools)
                print(f"Tools initialized successfully: {self.tools}")
            except Exception as e:
                print(f"Error initializing tools: {e}")
                self.llm_with_tools = self.llm
        else:
            self.llm_with_tools = self.llm
            print("No tools provided, using default LLM.")

    def get_fallback_response(self):
        return "Systems are currently offline. Please try again later."

    async def execute_tool(self, tool_name: str, tool_args: Dict) -> str:
        """Execute a tool call and return the result"""
        try:
            # Find the tool by name
            for tool in self.tools:
                if hasattr(tool, "name") and tool.name == tool_name:
                    # Execute the tool with the provided arguments
                    result = (
                        await tool.arun(**tool_args)
                        if hasattr(tool, "arun")
                        else tool.run(**tool_args)
                    )
                    return str(result)
            return f"Tool '{tool_name}' not found"
        except Exception as e:
            return f"Error executing tool '{tool_name}': {str(e)}"

    async def generate_response_stream(
        self,
        prompt: str,
        conversation_history: Optional[List[Dict]] = None,
        conversation_id: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream response with tool handling"""
        try:
            system_prompt = "You are a helpful assistant. Please provide accurate and concise responses."
            messages: List = [SystemMessage(content=system_prompt)]

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

            messages.append(HumanMessage(content=prompt))

            llm = self.llm_with_tools if self.tools else self.llm

            # Stream the initial response
            full_response = ""
            tool_calls = []

            async for chunk in llm.astream(messages):
                # Handle regular content
                if hasattr(chunk, "content") and chunk.content:
                    # Ensure content is a string
                    content_str = (
                        chunk.content
                        if isinstance(chunk.content, str)
                        else str(chunk.content)
                    )
                    full_response += content_str
                    yield content_str

                # Handle tool calls - use getattr for safe access
                chunk_tool_calls = getattr(chunk, "tool_calls", None)
                if chunk_tool_calls:
                    tool_calls.extend(chunk_tool_calls)
                # Alternative check for additional_kwargs which may contain tool_calls
                elif hasattr(chunk, "additional_kwargs") and isinstance(
                    chunk.additional_kwargs, dict
                ):
                    if "tool_calls" in chunk.additional_kwargs:
                        tool_calls.extend(chunk.additional_kwargs["tool_calls"])

            # If there are tool calls, execute them and continue the conversation
            if tool_calls:
                # Add the assistant's message with tool calls to the conversation
                ai_message = AIMessage(content=full_response)
                # Set tool_calls if the message supports it
                if hasattr(ai_message, "tool_calls"):
                    ai_message.tool_calls = tool_calls
                messages.append(ai_message)

                # Execute each tool call
                for tool_call in tool_calls:
                    # Handle different tool_call formats
                    if isinstance(tool_call, dict):
                        tool_name = tool_call.get("name", "")
                        tool_args = tool_call.get("args", {})
                        tool_call_id = tool_call.get("id", "")
                    else:
                        # Handle LangChain ToolCall objects
                        tool_name = getattr(tool_call, "name", "")
                        tool_args = getattr(tool_call, "args", {})
                        tool_call_id = getattr(tool_call, "id", "")

                    # Execute the tool
                    tool_result = await self.execute_tool(tool_name, tool_args)

                    # Add tool result to messages
                    messages.append(
                        ToolMessage(content=tool_result, tool_call_id=tool_call_id)
                    )

                    # Yield tool execution info to client
                    yield f"\n\n🔧 **Tool Used:** {tool_name}\n**Result:** {tool_result}\n\n"

                # Get final response from LLM after tool execution
                yield "\n**Final Response:**\n"
                async for chunk in llm.astream(messages):
                    if hasattr(chunk, "content") and chunk.content:
                        # Ensure content is a string
                        content_str = (
                            chunk.content
                            if isinstance(chunk.content, str)
                            else str(chunk.content)
                        )
                        yield content_str

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
