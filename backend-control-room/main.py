from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3

# Inizializziamo l'app FastAPI
app = FastAPI()

# Configurazione CORS (Fondamentale!)
# Permette al tuo frontend React (che gira su una porta diversa) di parlare con questo server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In produzione si mette l'indirizzo esatto, qui accettiamo tutto
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Endpoint 1: Verifica che il server sia acceso
@app.get("/")
def read_root():
    return {"status": "online", "message": "Backend Control Room Operativo"}

# Endpoint 2: Chiediamo al Database la lista delle missioni
@app.get("/api/missioni")
def get_missioni():
    conn = sqlite3.connect('control_room.db')
    cursor = conn.cursor()
    
    # Eseguiamo la stessa query di test che hai provato prima
    cursor.execute('''
    SELECT Missioni.id, Utenti.nome_cognome, Droni.nome, Piani_Volo.nome_percorso, Missioni.stato
    FROM Missioni
    JOIN Utenti ON Missioni.pilota_id = Utenti.id
    JOIN Droni ON Missioni.drone_id = Droni.id
    JOIN Piani_Volo ON Missioni.piano_volo_id = Piani_Volo.id
    ''')
    
    missioni_raw = cursor.fetchall()
    conn.close()

    # Trasformiamo la risposta grezza del database in un dizionario (JSON) pulito per React
    lista_missioni = []
    for m in missioni_raw:
        lista_missioni.append({
            "id_missione": m[0],
            "pilota": m[1],
            "drone": m[2],
            "rotta": m[3],
            "stato": m[4]
        })
        
    return lista_missioni