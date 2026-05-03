import sqlite3

def setup_database():
    # 1. Crea la connessione (se il file non esiste, lo crea lui in automatico!)
    conn = sqlite3.connect('control_room.db')
    cursor = conn.cursor()

    print("Creazione delle tabelle in corso...")

    # Tabella Utenti
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Utenti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_cognome TEXT NOT NULL,
        codice_badge TEXT UNIQUE NOT NULL,
        ruolo TEXT NOT NULL
    )''')

    # Tabella Droni
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Droni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        seriale_hardware TEXT UNIQUE NOT NULL,
        stato TEXT NOT NULL
    )''')

    # Tabella Payload (connessa ai Droni)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Payload (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        drone_id INTEGER,
        tipo TEXT NOT NULL,
        modello TEXT,
        FOREIGN KEY (drone_id) REFERENCES Droni(id)
    )''')

    # Tabella Piani di Volo
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Piani_Volo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_percorso TEXT NOT NULL,
        file_kmz_path TEXT NOT NULL
    )''')

    # Tabella Missioni (Il cuore: collega tutto)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Missioni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        piano_volo_id INTEGER,
        drone_id INTEGER,
        pilota_id INTEGER,
        supervisore_id INTEGER,
        stato TEXT NOT NULL,
        timestamp_inizio DATETIME,
        timestamp_fine DATETIME,
        FOREIGN KEY (piano_volo_id) REFERENCES Piani_Volo(id),
        FOREIGN KEY (drone_id) REFERENCES Droni(id),
        FOREIGN KEY (pilota_id) REFERENCES Utenti(id),
        FOREIGN KEY (supervisore_id) REFERENCES Utenti(id)
    )''')

    # Tabella Payload Data (I risultati della missione)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Payload_Data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        missione_id INTEGER,
        payload_id INTEGER,
        timestamp_rilevamento DATETIME DEFAULT CURRENT_TIMESTAMP,
        tipo_dato TEXT NOT NULL,
        valore_o_file TEXT NOT NULL,
        FOREIGN KEY (missione_id) REFERENCES Missioni(id),
        FOREIGN KEY (payload_id) REFERENCES Payload(id)
    )''')

    # Salva e chiudi
    conn.commit()
    conn.close()
    print("Finito! Il database 'control_room.db' è pronto all'uso.")

if __name__ == '__main__':
    setup_database()