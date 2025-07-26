from pydantic import BaseModel
from typing import List, Optional

class Message(BaseModel):
	prompt: str
	session_id: Optional[str] = None
	llm_model: Optional[str] = None
	tools: Optional[List[str]] = None

class Response(BaseModel):
	response: str
	session_id: str
	message_type: str = "text"
	sources: Optional[List[str]] = None

class DocumentUpload(BaseModel):
    filename: str
    content: str
    file_type: str
