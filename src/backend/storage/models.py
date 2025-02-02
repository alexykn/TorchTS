from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import os

# Create the database directory if it doesn't exist
os.makedirs('data', exist_ok=True)

# Create engine
engine = create_engine('sqlite:///data/torchts.db')
Base = declarative_base()

class Profile(Base):
    __tablename__ = 'profiles'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    voice_preset = Column(String)
    volume = Column(Float, default=0.7)
    
    files = relationship("File", back_populates="profile", cascade="all, delete-orphan")
    audio_outputs = relationship("AudioOutput", back_populates="profile", cascade="all, delete-orphan")

class File(Base):
    __tablename__ = 'files'
    
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey('profiles.id'))
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    content = Column(String, nullable=False)  # Stored text content
    pages = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    profile = relationship("Profile", back_populates="files")

class AudioOutput(Base):
    __tablename__ = 'audio_outputs'
    
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey('profiles.id'))
    file_path = Column(String, nullable=False)  # Path to stored audio file
    voice = Column(String, nullable=False)
    text_content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    profile = relationship("Profile", back_populates="audio_outputs")

# Create all tables
Base.metadata.create_all(engine)