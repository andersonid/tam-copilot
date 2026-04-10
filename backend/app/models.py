import secrets
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Date, DateTime, Boolean, LargeBinary,
    ForeignKey, Table, func,
)
from sqlalchemy.orm import relationship
from .database import Base


def _generate_token() -> str:
    return secrets.token_urlsafe(24)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

guide_tags = Table(
    "guide_tags",
    Base.metadata,
    Column("guide_id", Integer, ForeignKey("guides.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())

    guides = relationship("Guide", back_populates="customer")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())

    guides = relationship("Guide", back_populates="product")


class DocumentType(Base):
    __tablename__ = "document_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(255), nullable=False, unique=True)
    color = Column(String(7), nullable=False, default="#70728F")
    created_at = Column(DateTime, server_default=func.now())

    guides = relationship("Guide", back_populates="document_type")


class LLMProvider(Base):
    __tablename__ = "llm_providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    provider_type = Column(String(50), nullable=False)  # openai_compatible | anthropic | google_gemini
    base_url = Column(String(500), nullable=True)
    api_key_encrypted = Column(Text, nullable=True)
    default_model = Column(String(255), nullable=False)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    guides = relationship("Guide", back_populates="provider")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)

    guides = relationship("Guide", secondary=guide_tags, back_populates="tags")


class Guide(Base):
    __tablename__ = "guides"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    document_type_id = Column(Integer, ForeignKey("document_types.id"), nullable=False)
    provider_id = Column(Integer, ForeignKey("llm_providers.id"), nullable=True)
    model_used = Column(String(255), nullable=True)
    touchpoint_date = Column(Date, nullable=False, default=date.today)
    input_notes = Column(Text, nullable=False)
    html_filename = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, default="draft")
    kcs_subtype = Column(String(50), nullable=True)  # solution, howto, qa, troubleshooting, faq, hub
    access_token = Column(String(64), nullable=False, default=_generate_token, index=True)
    embedding = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    customer = relationship("Customer", back_populates="guides")
    product = relationship("Product", back_populates="guides")
    document_type = relationship("DocumentType", back_populates="guides")
    provider = relationship("LLMProvider", back_populates="guides")
    tags = relationship("Tag", secondary=guide_tags, back_populates="guides")
