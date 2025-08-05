from langchain.tools.retriever import create_retriever_tool
from langchain_core.tools import tool
from typing import List, Optional
from pydantic import BaseModel, Field
from services.embedding_provider import RAGService


class search_query(BaseModel):
    query: str = Field(..., description="The search query to retrieve information.")
    conversation_id: str = Field(
        ..., description="The conversation ID to search within."
    )


@tool
def information_retriever(query: search_query) -> str:
    """
    Retrieve information based on the provided query from the documents uploaded in the current conversation.
    This tool searches through documents that have been attached to the conversation.

    Args:
        query: The search query and conversation ID to retrieve information.
    Returns:
        The retrieved information as a string.
    """
    try:
        rag_service = RAGService()
        docs = rag_service.search_documents(query.query, query.conversation_id, k=3)

        if not docs:
            return "No relevant information found in the uploaded documents."

        result = "Here's what I found in the uploaded documents:\n\n"
        for i, doc in enumerate(docs, 1):
            result += f"--- Document Excerpt {i} ---\n{doc.page_content}\n\n"

        return result
    except Exception as e:
        return f"Error retrieving information: {str(e)}"
