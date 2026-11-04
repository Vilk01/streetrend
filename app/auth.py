from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from . import models

SECRET_KEY = "super_secret_key_123"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def hash_password(password: str): return pwd_context.hash(password)
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)
def create_token(data: dict):
    return jwt.encode({**data, "exp": datetime.utcnow() + timedelta(days=7)}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user = db.query(models.User).filter(models.User.user_id == int(payload.get("sub"))).first()
        if not user: raise HTTPException(401, "Ошибка токена")
        return user
    except JWTError: raise HTTPException(401, "Ошибка токена")

def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        admin = db.query(models.Admin).filter(models.Admin.admin_id == int(payload.get("sub"))).first()
        if not admin: raise HTTPException(403, "Вы не админ")
        return admin
    except JWTError: raise HTTPException(401, "Ошибка токена")

def require_role(roles: list):
    def checker(admin: models.Admin = Depends(get_current_admin)):
        if admin.role not in roles: raise HTTPException(403, "Нет прав")
        return admin
    return checker