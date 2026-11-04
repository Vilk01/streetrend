from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from .. import models, schemas, auth
from ..database import get_db
import shutil, uuid, os

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=schemas.Token)
def register(data: schemas.UserRegister, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(400, "Почта занята")
    user = models.User(**data.dict(exclude={"password"}), password=auth.hash_password(data.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"access_token": auth.create_token({"sub": str(user.user_id)}), "token_type": "bearer", "user": {"user_id": user.user_id, "name": user.name, "is_admin": False}}

@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not auth.verify_password(form.password, user.password): raise HTTPException(401, "Неверный логин или пароль")
    return {"access_token": auth.create_token({"sub": str(user.user_id)}), "token_type": "bearer", "user": {"user_id": user.user_id, "name": user.name, "is_admin": False}}

@router.post("/admin-login")
def admin_login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    admin = db.query(models.Admin).filter(models.Admin.email == form.username).first()
    if not admin or not auth.verify_password(form.password, admin.password): raise HTTPException(401, "Неверный логин или пароль")
    return {"access_token": auth.create_token({"sub": str(admin.admin_id)}), "token_type": "bearer", "user": {"user_id": admin.admin_id, "name": admin.name, "role": admin.role, "is_admin": True}}

@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(auth.get_current_user)): return user

@router.post("/avatar")
def upload_avatar(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    os.makedirs("uploads", exist_ok=True)
    ext = file.filename.split(".")[-1]
    filename = f"avatar_{current_user.user_id}.{ext}"
    with open(f"uploads/{filename}", "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    current_user.avatar_url = f"/uploads/{filename}"
    db.commit()
    return {"avatar_url": current_user.avatar_url}