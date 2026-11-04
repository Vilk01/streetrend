from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from .database import Base, engine, SessionLocal
from .routers import users, catalog, admin, orders
from . import models

Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.middleware("http")
async def add_corp_header(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/uploads/"):
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    return response

app.include_router(users.router)
app.include_router(catalog.router)
app.include_router(admin.router)
app.include_router(orders.router)

@app.on_event("startup")
def seed():
    db = SessionLocal()
    if db.query(models.Branch).count() == 0:
        db.add(models.Branch(address="ул. Ленина 1", city="Новосибирск"))
        db.commit()
    db.close()