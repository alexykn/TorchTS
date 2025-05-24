from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime, Float, MetaData, select
from sqlalchemy.orm import declarative_base, relationship, Session, sessionmaker
try:
    from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
    ASYNC_AVAILABLE = True
except Exception:  # pragma: no cover - fallback if asyncio support missing
    AsyncEngine = None
    AsyncSession = None
    create_async_engine = None
    ASYNC_AVAILABLE = False
from datetime import datetime, timezone
import os

# Create the database directory if it doesn't exist
os.makedirs('data', exist_ok=True)

# Define a naming convention for indexes and constraints
metadata = MetaData(naming_convention={
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
})

Base = declarative_base(metadata=metadata)

# Helper function for timezone-aware UTC timestamp
def utc_now():
    return datetime.now(timezone.utc)

class Profile(Base):
    __tablename__ = 'profiles'
    
    id: int = Column(Integer, primary_key=True)
    name: str = Column(String, unique=True, nullable=False)
    created_at: datetime = Column(DateTime(timezone=True), default=utc_now)
    voice_preset: str = Column(String)
    volume: float = Column(Float, default=0.8)
    
    files = relationship("File", back_populates="profile", cascade="all, delete-orphan")
    audio_outputs = relationship("AudioOutput", back_populates="profile", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Profile(id={self.id}, name={self.name})>"

class File(Base):
    __tablename__ = 'files'
    
    id: int = Column(Integer, primary_key=True)
    profile_id: int = Column(Integer, ForeignKey('profiles.id'), index=True)
    filename: str = Column(String, nullable=False)
    file_type: str = Column(String, nullable=False)
    content: str = Column(String, nullable=False)  # Stored text content
    pages: int = Column(Integer)
    created_at: datetime = Column(DateTime(timezone=True), default=utc_now)
    
    profile = relationship("Profile", back_populates="files")
    
    def __repr__(self):
        return f"<File(id={self.id}, filename={self.filename})>"

class AudioOutput(Base):
    __tablename__ = 'audio_outputs'
    
    id: int = Column(Integer, primary_key=True)
    profile_id: int = Column(Integer, ForeignKey('profiles.id'), index=True)
    file_path: str = Column(String, nullable=False)  # Path to stored audio file
    voice: str = Column(String, nullable=False)
    text_content: str = Column(String, nullable=False)
    created_at: datetime = Column(DateTime(timezone=True), default=utc_now)
    
    profile = relationship("Profile", back_populates="audio_outputs")
    
    def __repr__(self):
        return f"<AudioOutput(id={self.id}, file_path={self.file_path})>"

# Create synchronous engine
engine = create_engine('sqlite:///data/torchts.db')

# Attempt to create asynchronous engine if supported
if ASYNC_AVAILABLE:
    try:
        async_engine: AsyncEngine = create_async_engine(
            'sqlite+aiosqlite:///data/torchts.db'
        )
        AsyncSessionLocal = sessionmaker(
            bind=async_engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )
        ASYNC_DB = True
    except Exception:
        async_engine = None
        AsyncSessionLocal = None
        ASYNC_DB = False
else:
    async_engine = None
    AsyncSessionLocal = None
    ASYNC_DB = False

# Create all tables
if engine is not None:
    Base.metadata.create_all(engine)

# Create default profile if none exists
def create_default_profile():
    if engine is None:
        return
    with Session(engine) as session:
        if session.query(Profile).count() == 0:
            default_profile = Profile(
                name="Default Profile",
                voice_preset="am_michael",  # Default voice
                volume=0.8,  # Match frontend volume setting
            )
            session.add(default_profile)
            session.commit()

# Create default profile when module is imported
create_default_profile()