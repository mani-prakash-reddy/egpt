import os
import dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables
dotenv.load_dotenv()

# Database setup
DATABASE_URL = os.getenv("PG_VECTOR_DB")
if not DATABASE_URL:
    print("⚠️ Warning: PG_VECTOR_DB environment variable is not set")
    DATABASE_URL = "sqlite:///./test.db"  # Fallback to SQLite for testing

try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
    print(f"✅ Database engine created successfully")
except Exception as e:
    print(f"⚠️ Warning: Could not create database engine: {e}")
    print("Using SQLite fallback")
    engine = create_engine("sqlite:///./test.db")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
