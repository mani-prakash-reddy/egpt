from langchain_ollama.chat_models import ChatOllama
from langchain_core.messages import HumanMessage

llm = ChatOllama(base_url="http://host.docker.internal:11434", model="qwen3:4b")

print(llm.invoke([HumanMessage(content="hey")]))