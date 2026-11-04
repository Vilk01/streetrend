from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserRegister(BaseModel):
    name: str
    lastname: str
    phone: str
    email: EmailStr
    city: str
    password: str

class UserOut(BaseModel):
    user_id: int
    name: str
    lastname: str
    fathername: Optional[str] = None
    phone: str
    email: EmailStr
    city: str
    avatar_url: Optional[str] = None
    class Config: from_attributes = True

class CatalogOut(BaseModel):
    item_id: int
    item_title: str
    description: Optional[str]
    category: str
    rent_price: float
    image_url: Optional[str]
    class Config: from_attributes = True

class CatalogCreate(BaseModel):
    item_title: str
    description: Optional[str] = None
    category: str
    rent_price: float
    image_url: Optional[str] = None
    branch_ids: List[int] = []

class BranchOut(BaseModel):
    branch_id: int
    address: str
    city: str
    class Config: from_attributes = True

class OrderCreate(BaseModel):
    item_id: int
    branch_id: int
    start_time: datetime
    end_time: datetime
    payment_method: str
    total_price: float

class OrderIssue(BaseModel):
    actual_start_time: str

class OrderReturn(BaseModel):
    fine_amount: float = 0.0
    actual_return_time: str

class OrderOut(BaseModel):
    order_id: int
    user_id: int
    item_id: int
    status: str
    order_date: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    actual_start_time: Optional[datetime] = None
    actual_return_time: Optional[datetime] = None
    fine: float
    branch_id: int
    total_price: float
    payment_method: str
    class Config: from_attributes = True

class AdminCreate(BaseModel):
    name: str
    lastname: str
    email: EmailStr
    password: str
    role: str # "super", "senior", "junior"
    branch_id: Optional[int] = None

class AdminUpdate(BaseModel):
    name: str
    lastname: str
    email: EmailStr
    role: str
    branch_id: Optional[int] = None
    password: Optional[str] = None

class AdminOut(BaseModel):
    admin_id: int
    name: str
    lastname: str
    email: str
    role: str
    branch_id: Optional[int] = None
    class Config:
        from_attributes = True