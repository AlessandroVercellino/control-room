# create_tables.py
from database import engine, Base

print("Bussando alla porta di PostgreSQL dentro Docker...")
try:
    # Questo comando magico prende tutti i modelli definiti sopra e crea le tabelle nel DB
    Base.metadata.create_all(bind=engine)
    print("🎉 Spaziale! Tabelle PostGIS create con successo nel database su Docker!")
except Exception as e:
    print(f"❌ Errore durante la creazione delle tabelle: {e}")