import sqlite3

DB_NAME = 'control_room.db'

def add_mission():
    print("\n--- 🛠️ NEW MISSION ---")
    route_name = input("Enter route name (e.g., Pipe Inspection): ")
    file_path = input("Enter file path (e.g., /ugcs/pipes.json): ")
    status = input("Enter status (e.g., Selected, Done, On_Flight): ")

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # Fetch the first available pilot and drone from the database
    cursor.execute("SELECT id FROM Utenti LIMIT 1")
    pilot = cursor.fetchone()
    
    cursor.execute("SELECT id FROM Droni LIMIT 1")
    drone = cursor.fetchone()

    if not pilot or not drone:
        print("Error: Database is empty! Please initialize it first.")
        conn.close()
        return

    # 1. Insert Flight Plan
    cursor.execute("INSERT INTO Piani_Volo (nome_percorso, file_kmz_path) VALUES (?, ?)", (route_name, file_path))
    flight_plan_id = cursor.lastrowid

    # 2. Insert Mission linking all IDs
    cursor.execute('''
        INSERT INTO Missioni (piano_volo_id, drone_id, pilota_id, stato, timestamp_inizio)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ''', (flight_plan_id, drone[0], pilot[0], status))

    conn.commit()
    conn.close()
    print(f"✅ Mission '{route_name}' successfully saved to database!\n")

def show_missions():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Query to fetch mission details using JOINs
    cursor.execute('''
        SELECT Missioni.id, Piani_Volo.nome_percorso, Missioni.stato
        FROM Missioni
        JOIN Piani_Volo ON Missioni.piano_volo_id = Piani_Volo.id
    ''')
    missions = cursor.fetchall()
    
    print("\n--- 🗂️ CURRENT MISSIONS IN DB ---")
    for m in missions:
        print(f"ID: {m[0]} | Route: {m[1]} | Status: {m[2]}")
    print("----------------------------------\n")
    
    conn.close()

# Interactive CLI menu
if __name__ == '__main__':
    while True:
        print("=== DATABASE CONTROL PANEL ===")
        print("1. ➕ Add a new mission")
        print("2. 👁️  Show saved missions")
        print("3. ❌ Exit")
        
        choice = input("Select an option (1/2/3): ")

        if choice == '1':
            add_mission()
        elif choice == '2':
            show_missions()
        elif choice == '3':
            print("Exiting...")
            break
        else:
            print("Invalid choice, please try again.\n")