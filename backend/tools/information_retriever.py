from langchain.tools.retriever import create_retriever_tool
from langchain_core.tools import tool
from typing import List, Optional
from pydantic import BaseModel, Field
from services.embedding_provider import RAGService


class search_query(BaseModel):
    query: str = Field(..., description="The search query to retrieve information.")


# @tool
def information_retriever(query: search_query) -> str: ...
