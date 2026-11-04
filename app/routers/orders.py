from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db
from typing import List

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("/", response_model=schemas.OrderOut)
def create_order(data: schemas.OrderCreate, db: Session = Depends(get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    inv = db.query(models.Inventory).filter(models.Inventory.item_id == data.item_id,
                                            models.Inventory.branch_id == data.branch_id).first()
    if not inv or inv.total_in_storage <= 0: raise HTTPException(400, "Товар закончился на филиале")
    conflict = db.query(models.Order).filter(
        models.Order.item_id == data.item_id,
        models.Order.branch_id == data.branch_id,
        models.Order.status.in_(["pending", "active"]),
        models.Order.start_time < data.end_time,
        models.Order.end_time > data.start_time
    ).first()

    if conflict:
        raise HTTPException(400, "Этот товар уже забронирован на выбранное время!")

    order = models.Order(
        user_id=current_user.user_id, item_id=data.item_id, branch_id=data.branch_id,
        status="pending", start_time=data.start_time, end_time=data.end_time,
        payment_method=data.payment_method, total_price=data.total_price
    )
    db.add(order)
    inv.total_in_storage -= 1
    db.commit();
    db.refresh(order)
    return order


@router.get("/my", response_model=List[schemas.OrderOut])
def my_orders(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Order).filter(models.Order.user_id == current_user.user_id).order_by(
        models.Order.order_date.desc()).all()