import sqlite3

def popola_e_leggi():
    # Ci colleghiamo al database appena creato
    conn = sqlite3.connect('control_room.db')
    cursor = conn.cursor()

    print("1. Inserimento dati base...")
    
    # Creiamo Te come Pilota
    cursor.execute("INSERT INTO Utenti (nome_cognome, codice_badge, ruolo) VALUES ('Tuo Nome', 'PLT-001', 'Pilota')")
    pilota_id = cursor.lastrowid # Catturiamo l'ID appena generato!

    # Creiamo il Mavic 3E
    cursor.execute("INSERT INTO Droni (nome, seriale_hardware, stato) VALUES ('DJI Mavic 3E', 'SN-M3E-999', 'Attivo')")
    drone_id = cursor.lastrowid

    # Inseriamo il Piano di Volo
    cursor.execute("INSERT INTO Piani_Volo (nome_percorso, file_kmz_path) VALUES ('Emergenza IPLOM', '/ugcs/emergenza.json')")
    piano_volo_id = cursor.lastrowid

    print("2. Creazione della Missione (L'incrocio dei dati)...")
    
    # Creiamo la Missione usando gli ID catturati sopra
    cursor.execute('''
    INSERT INTO Missioni (piano_volo_id, drone_id, pilota_id, stato, timestamp_inizio)
    VALUES (?, ?, ?, 'Selected', CURRENT_TIMESTAMP)
    ''', (piano_volo_id, drone_id, pilota_id))

    # Salviamo le modifiche
    conn.commit()

    print("3. Lettura dei dati (La Magia delle JOIN)...\n")
    
    # Questa è la VERA potenza dei database relazionali: la JOIN.
    # Chiediamo al DB di prendere la missione e andare a pescare i nomi reali dalle altre tabelle.
    cursor.execute('''
    SELECT 
        Missioni.id, 
        Utenti.nome_cognome, 
        Droni.nome, 
        Piani_Volo.nome_percorso, 
        Missioni.stato,
        Missioni.timestamp_inizio
    FROM Missioni
    JOIN Utenti ON Missioni.pilota_id = Utenti.id
    JOIN Droni ON Missioni.drone_id = Droni.id
    JOIN Piani_Volo ON Missioni.piano_volo_id = Piani_Volo.id
    ''')

    # Stampiamo il risultato a schermo
    missione = cursor.fetchone()
    print(f"--- RIEPILOGO MISSIONE #{missione[0]} ---")
    print(f"Pilota Responsabile : {missione[1]}")
    print(f"Drone Assegnato     : {missione[2]}")
    print(f"Rotta Caricata      : {missione[3]}")
    print(f"Stato Attuale       : {missione[4]}")
    print(f"Orario Inizio       : {missione[5]}")

    conn.close()

if __name__ == '__main__':
    popola_e_leggi()