import sqlite3

def setup_database():
    conn = sqlite3.connect('control_room.db')
    cursor = conn.cursor()

    print("Creating database tables...")

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        badge_code TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL
    )''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Drones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hardware_serial TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL
    )''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Flight_Plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_name TEXT NOT NULL,
        file_kmz_path TEXT NOT NULL,
        waypoints TEXT NOT NULL,
        details TEXT
    )''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Missions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flight_plan_id INTEGER,
        drone_id INTEGER,
        pilot_id INTEGER,
        status TEXT NOT NULL,
        start_timestamp DATETIME,
        FOREIGN KEY (flight_plan_id) REFERENCES Flight_Plans(id),
        FOREIGN KEY (drone_id) REFERENCES Drones(id),
        FOREIGN KEY (pilot_id) REFERENCES Users(id)
    )''')

    conn.commit()
    conn.close()
    print("Done! 'control_room.db' is ready with waypoints support.")

if __name__ == '__main__':
    setup_database()