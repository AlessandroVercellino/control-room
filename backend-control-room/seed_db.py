# seed_db.py
from database import SessionLocal, User
from main import get_password_hash # Importiamo la funzione per criptare

def seed_database():
    db = SessionLocal()
    if not db.query(User).first():
        admin = User(
            full_name="Alessandro", 
            badge_code="admin123",
            role="responsabile",
            hashed_password=get_password_hash("password123") # <--- Inserisci qui la tua password per il primo login
        )
        db.add(admin)
        db.commit()
        print("✅ Primo admin creato! Usa 'admin123' e 'password123'")
    db.close()

if __name__ == "__main__":
    seed_database()