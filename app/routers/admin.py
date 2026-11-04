import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/branches")
def create_branch(data: dict, db: Session = Depends(get_db),
                  admin: models.Admin = Depends(auth.require_role(["super"]))):
    branch = models.Branch(address=data["address"], city=data["city"])
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch

@router.get("/branches", response_model=List[schemas.BranchOut])
def get_all_branches(db: Session = Depends(get_db), admin: models.Admin = Depends(auth.get_current_admin)):
    return db.query(models.Branch).all()


@router.post("/catalog/upload")
def upload_catalog_image(file: UploadFile = File(...), admin: models.Admin = Depends(auth.get_current_admin)):
    os.makedirs("uploads", exist_ok=True)
    ext = file.filename.split(".")[-1]
    filename = f"item_{uuid.uuid4().hex[:6]}.{ext}"
    filepath = f"uploads/{filename}"

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"image_url": f"/uploads/{filename}"}

@router.post("/catalog", response_model=schemas.CatalogOut)
def add_item(data: schemas.CatalogCreate, db: Session = Depends(get_db),
             admin: models.Admin = Depends(auth.get_current_admin)):
    item = models.Catalog(
        item_title=data.item_title,
        description=data.description,
        category=data.category,
        rent_price=data.rent_price,
        image_url=data.image_url
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    if data.branch_ids:
        for b_id in data.branch_ids:
            inv = models.Inventory(item_id=item.item_id, branch_id=b_id, total_in_storage=5)
            db.add(inv)
    else:
        default_branch = admin.branch_id or 1
        inv = models.Inventory(item_id=item.item_id, branch_id=default_branch, total_in_storage=5)
        db.add(inv)

    db.commit()
    return item

@router.put("/catalog/{item_id}", response_model=schemas.CatalogOut)
def update_item(item_id: int, data: schemas.CatalogCreate, db: Session = Depends(get_db),
                admin: models.Admin = Depends(auth.get_current_admin)):
    item = db.query(models.Catalog).filter(models.Catalog.item_id == item_id).first()
    if not item:
        raise HTTPException(404, "Товар не найден")

    item.item_title = data.item_title
    item.description = data.description
    item.category = data.category
    item.rent_price = data.rent_price
    if data.image_url:
        item.image_url = data.image_url

    if data.branch_ids:
        db.query(models.Inventory).filter(models.Inventory.item_id == item_id).delete()
        for b_id in data.branch_ids:
            db.add(models.Inventory(item_id=item_id, branch_id=b_id, total_in_storage=5))

    db.commit()
    db.refresh(item)
    return item

@router.delete("/catalog/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db),
                admin: models.Admin = Depends(auth.require_role(["super", "senior"]))):
    item = db.query(models.Catalog).filter(models.Catalog.item_id == item_id).first()
    if not item:
        raise HTTPException(404, "Товар не найден")

    db.query(models.Inventory).filter(models.Inventory.item_id == item_id).delete()
    db.delete(item)
    db.commit()
    return {"status": "ok"}

@router.get("/orders", response_model=List[schemas.OrderOut])
def get_admin_orders(db: Session = Depends(get_db), admin: models.Admin = Depends(auth.get_current_admin)):
    query = db.query(models.Order)

    if admin.role != "super" and admin.branch_id:
        query = query.filter(models.Order.branch_id == admin.branch_id)

    return query.order_by(models.Order.order_date.desc()).all()

@router.post("/orders/{order_id}/issue")
def issue_order(
        order_id: int,
        data: schemas.OrderIssue,
        db: Session = Depends(get_db),
        admin: models.Admin = Depends(auth.get_current_admin)
):
    order = db.query(models.Order).filter(models.Order.order_id == order_id).first()
    if not order: raise HTTPException(404, "Заказ не найден")
    if order.status != "pending": raise HTTPException(400, "Заказ уже выдан")

    order.status = "active"
    # Берем время из data
    order.actual_start_time = datetime.fromisoformat(data.actual_start_time.replace('Z', '+00:00'))
    db.commit()
    return {"status": "ok"}

@router.post("/orders/{order_id}/return")
def return_order(
        order_id: int,
        data: schemas.OrderReturn,
        db: Session = Depends(get_db),
        admin: models.Admin = Depends(auth.get_current_admin)
):
    order = db.query(models.Order).filter(models.Order.order_id == order_id).first()
    if not order: raise HTTPException(404, "Заказ не найден")
    if order.status != "active": raise HTTPException(400, "Нельзя вернуть невыданный товар")

    order.status = "completed"
    order.actual_return_time = datetime.fromisoformat(data.actual_return_time.replace('Z', '+00:00'))

    if data.fine_amount > 0:
        order.fine += data.fine_amount

    inv = db.query(models.Inventory).filter(
        models.Inventory.item_id == order.item_id,
        models.Inventory.branch_id == order.branch_id
    ).first()
    if inv:
        inv.total_in_storage += 1

    db.commit()
    return {"status": "ok"}

@router.get("/admins", response_model=List[schemas.AdminOut])
def get_admins(db: Session = Depends(get_db), admin: models.Admin = Depends(auth.require_role(["super"]))):
    return db.query(models.Admin).all()

@router.post("/admins")
def create_admin(data: schemas.AdminCreate, db: Session = Depends(get_db),
                 admin: models.Admin = Depends(auth.require_role(["super"]))):
    if db.query(models.Admin).filter(models.Admin.email == data.email).first():
        raise HTTPException(400, "Админ с такой почтой уже существует")

    new_admin = models.Admin(
        name=data.name,
        lastname=data.lastname,
        email=data.email,
        role=data.role,
        branch_id=data.branch_id,
        password=auth.hash_password(data.password)
    )
    db.add(new_admin)
    db.commit()
    return {"status": "ok"}

@router.put("/admins/{admin_id}")
def update_admin(admin_id: int, data: schemas.AdminUpdate, db: Session = Depends(get_db),
                 admin: models.Admin = Depends(auth.require_role(["super"]))):
    target = db.query(models.Admin).filter(models.Admin.admin_id == admin_id).first()
    if not target:
        raise HTTPException(404, "Админ не найден")

    target.name = data.name
    target.lastname = data.lastname
    target.email = data.email
    target.role = data.role
    target.branch_id = data.branch_id

    if data.password and len(data.password) > 0:
        target.password = auth.hash_password(data.password)

    db.commit()
    return {"status": "ok"}

@router.delete("/admins/{admin_id}")
def delete_admin(admin_id: int, db: Session = Depends(get_db),
                 admin: models.Admin = Depends(auth.require_role(["super"]))):
    if admin_id == admin.admin_id:
        raise HTTPException(400, "Вы не можете удалить самого себя")

    target = db.query(models.Admin).filter(models.Admin.admin_id == admin_id).first()
    if target:
        db.delete(target)
        db.commit()
    return {"status": "ok"}

@router.delete("/branches/{branch_id}")
def delete_branch(branch_id: int, db: Session = Depends(get_db),
                  admin: models.Admin = Depends(auth.require_role(["super"]))):
    branch = db.query(models.Branch).filter(models.Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Филиал не найден")

    active_orders = db.query(models.Order).filter(
        models.Order.branch_id == branch_id,
        models.Order.status.in_(["pending", "active"])
    ).first()
    if active_orders:
        raise HTTPException(400, "Нельзя удалить филиал, есть активные заказы")

    db.query(models.Admin).filter(models.Admin.branch_id == branch_id).update({"branch_id": None})

    db.query(models.Inventory).filter(models.Inventory.branch_id == branch_id).delete()

    db.delete(branch)
    db.commit()
    return {"status": "ok"}