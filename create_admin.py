from app.database import SessionLocal
from app import models
from app.auth import hash_password

def create_admin():
    db = SessionLocal()
    try:
        if db.query(models.Admin).count() == 0:
            admin = models.Admin(
                name="Admin", lastname="Super", email="admin@mail.ru",
                role="super", password=hash_password("123456"), branch_id=1
            )
            db.add(admin)
            db.commit()
            print("✅ Админ создан: admin@mail.ru / 123456")
        else:
            print("⚠️ Админ уже существует.")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()