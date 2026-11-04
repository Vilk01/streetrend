from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    lastname = Column(String, nullable=False)
    fathername = Column(String, nullable=True)
    phone = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    city = Column(String, nullable=False)
    password = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    orders = relationship("Order", back_populates="user")


class Admin(Base):
    __tablename__ = "admins"
    admin_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    lastname = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(String, default="junior")
    password = Column(String, nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.branch_id"), nullable=True)


class Branch(Base):
    __tablename__ = "branches"
    branch_id = Column(Integer, primary_key=True, index=True)
    address = Column(String, nullable=False)
    city = Column(String, nullable=False)
    orders = relationship("Order", back_populates="branch")
    inventory = relationship("Inventory", back_populates="branch")


class Catalog(Base):
    __tablename__ = "catalog"
    item_id = Column(Integer, primary_key=True, index=True)
    item_title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=False)
    rent_price = Column(Float, nullable=False)
    image_url = Column(String, nullable=True)
    orders = relationship("Order", back_populates="item")
    inventory = relationship("Inventory", back_populates="item")


class Inventory(Base):
    __tablename__ = "inventory"
    item_id = Column(Integer, ForeignKey("catalog.item_id"), primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.branch_id"), primary_key=True)
    total_in_storage = Column(Integer, default=0)
    branch = relationship("Branch", back_populates="inventory")
    item = relationship("Catalog", back_populates="inventory")


class Order(Base):
    __tablename__ = "orders"
    order_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    item_id = Column(Integer, ForeignKey("catalog.item_id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.branch_id"), nullable=False)
    status = Column(String, default="pending")
    order_date = Column(DateTime, default=datetime.utcnow)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    actual_start_time = Column(DateTime, nullable=True)
    actual_return_time = Column(DateTime, nullable=True)
    fine = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)
    payment_method = Column(String, default="cash")

    user = relationship("User", back_populates="orders")
    item = relationship("Catalog", back_populates="orders")
    branch = relationship("Branch", back_populates="orders")