from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional, List
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

@router.get("/", response_model=List[schemas.CatalogOut])
def get_catalog(category: Optional[str] = None, search: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Catalog)
    if category: q = q.filter(models.Catalog.category == category)
    if search: q = q.filter(models.Catalog.item_title.ilike(f"%{search}%"))
    return q.all()

@router.get("/branches", response_model=List[schemas.BranchOut])
def get_branches(db: Session = Depends(get_db)):
    return db.query(models.Branch).all()

@router.get("/item/{item_id}/branches", response_model=List[schemas.BranchOut])
def get_item_branches(item_id: int, db: Session = Depends(get_db)):
    inventories = db.query(models.Inventory).filter(
        models.Inventory.item_id == item_id,
        models.Inventory.total_in_storage > 0
    ).all()

    branch_ids = [inv.branch_id for inv in inventories]
    if not branch_ids:
        return []

    return db.query(models.Branch).filter(models.Branch.branch_id.in_(branch_ids)).all()