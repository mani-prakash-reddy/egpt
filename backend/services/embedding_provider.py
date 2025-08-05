import os
import uuid
from typing import List, Union, Optional, BinaryIO
import dotenv
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException
from database.db_models import Document, ConversationAttachment
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document as LangchainDocument
from langchain_community.vectorstores import PGVector
from langchain_openai import OpenAIEmbeddings
from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    TextLoader,
    CSVLoader,
)
import tempfile
import shutil


class RAGService:
    def __init__(self):
        self.connection_string = os.getenv("PG_VECTOR_DB")
        self.collection_name = "document_embeddings"
        self.embeddings = OpenAIEmbeddings()

    def get_vector_store(self, conversation_id: str):
        """Get vector store for a specific conversation"""
        collection_name = f"{self.collection_name}_{conversation_id}"
        return PGVector(
            connection_string=self.connection_string,
            embedding_function=self.embeddings,
            collection_name=collection_name,
        )

    def add_documents(self, documents: List[LangchainDocument], conversation_id: str):
        """Add documents to the vector store"""
        vector_store = self.get_vector_store(conversation_id)
        vector_store.add_documents(documents)
        return True

    def search_documents(self, query: str, conversation_id: str, k: int = 5):
        """Search documents by similarity"""
        try:
            vector_store = self.get_vector_store(conversation_id)
            docs = vector_store.similarity_search(query, k=k)
            return docs
        except Exception as e:
            print(f"Error searching documents: {e}")
            return []


class DocumentService:
    def __init__(self):
        self.rag_service = RAGService()
        self.supported_extensions = {
            ".pdf": PyPDFLoader,
            ".docx": Docx2txtLoader,
            ".txt": TextLoader,
            ".csv": CSVLoader,
        }
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200
        )

    async def upload_document(
        self,
        file: UploadFile,
        conversation_id: str,
        user_id: str,
        organization_id: str,
        db: Session,
    ):
        """Upload and process documents for RAG in a specific conversation."""
        try:
            # Extract file extension and check if supported
            filename = file.filename
            file_extension = os.path.splitext(filename)[1].lower()

            if file_extension not in self.supported_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type. Supported types: {', '.join(self.supported_extensions.keys())}",
                )

            # Create temporary file
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=file_extension
            ) as temp_file:
                # Copy uploaded file content to temp file
                shutil.copyfileobj(file.file, temp_file)
                temp_file_path = temp_file.name

            try:
                # Process the document based on its type
                loader_class = self.supported_extensions[file_extension]
                loader = loader_class(temp_file_path)
                documents = loader.load()

                # Split the documents into chunks
                document_chunks = self.text_splitter.split_documents(documents)

                # Create document in database
                db_document = Document(
                    id=str(uuid.uuid4()),
                    organization_id=organization_id,
                    user_id=user_id,
                    filename=filename,
                    file_type=file_extension,
                    file_size=os.path.getsize(temp_file_path),
                    content_type=file.content_type,
                )
                db.add(db_document)

                # Create conversation attachment
                conversation_attachment = ConversationAttachment(
                    id=str(uuid.uuid4()),
                    conversation_id=conversation_id,
                    document_id=db_document.id,
                )
                db.add(conversation_attachment)
                db.commit()

                # Add documents to vector store
                self.rag_service.add_documents(document_chunks, conversation_id)

                return {
                    "document_id": db_document.id,
                    "filename": filename,
                    "chunks": len(document_chunks),
                }

            finally:
                # Remove temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Error uploading document: {str(e)}"
            )

    def get_conversation_documents(self, conversation_id: str, db: Session):
        """Get all documents attached to a conversation"""
        attachments = (
            db.query(ConversationAttachment)
            .filter(ConversationAttachment.conversation_id == conversation_id)
            .all()
        )

        document_ids = [attachment.document_id for attachment in attachments]
        documents = db.query(Document).filter(Document.id.in_(document_ids)).all()

        return [
            {
                "id": doc.id,
                "filename": doc.filename,
                "file_type": doc.file_type,
                "file_size": doc.file_size,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            }
            for doc in documents
        ]

    def delete_document(self, document_id: str, user_id: str, db: Session):
        """Delete a document and remove from vector store"""
        document = (
            db.query(Document)
            .filter(Document.id == document_id, Document.user_id == user_id)
            .first()
        )

        if not document:
            raise HTTPException(
                status_code=404, detail="Document not found or access denied"
            )

        # Get all conversation attachments to delete them from vector store
        attachments = (
            db.query(ConversationAttachment)
            .filter(ConversationAttachment.document_id == document_id)
            .all()
        )

        # Delete document and attachments
        db.query(ConversationAttachment).filter(
            ConversationAttachment.document_id == document_id
        ).delete()

        db.delete(document)
        db.commit()

        return {"success": True, "message": "Document deleted successfully"}
