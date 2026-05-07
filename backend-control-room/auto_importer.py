import os
import json
import math
import sqlite3

DB_NAME = 'control_room.db'
MISSIONS_DIR = 'ugcs_missions'

def init_seed_data():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO Users (full_name, badge_code, role) VALUES ('Test Pilot', 'PLT-001', 'Pilot')")
    cursor.execute("INSERT OR IGNORE INTO Drones (name, hardware_serial, status) VALUES ('DJI Mavic 3E', 'SN-M3E-999', 'Active')")
    conn.commit()
    conn.close()

def extract_waypoints(data):
    points = []
    def search_points(obj):
        if isinstance(obj, dict) and 'latitude' in obj and 'longitude' in obj and isinstance(obj['latitude'], (int, float)):
            lat = obj['latitude'] * (180.0 / math.pi)
            lon = obj['longitude'] * (180.0 / math.pi)
            points.append([lat, lon])
        elif isinstance(obj, list):
            for item in obj:
                search_points(item)
        elif isinstance(obj, dict):
            for val in obj.values():
                search_points(val)
                
    search_points(data)
    return points

# NEW: Extracts extra technical data from the UgCS JSON
def extract_mission_details(data, waypoints_count):
    max_alt = 0.0
    
    def find_alt(obj):
        nonlocal max_alt
        if isinstance(obj, dict):
            if 'altitude' in obj and isinstance(obj['altitude'], (int, float)):
                if obj['altitude'] > max_alt:
                    max_alt = obj['altitude']
            for v in obj.values():
                find_alt(v)
        elif isinstance(obj, list):
            for item in obj:
                find_alt(item)
                
    find_alt(data)
    
    details = {
        "max_altitude_m": round(max_alt, 1),
        "total_waypoints": waypoints_count,
        "source_software": "UgCS",
        "flight_type": "Automated 3D Mapping" if max_alt > 20 else "Low Altitude Inspection"
    }
    return details

def scan_and_import():
    if not os.path.exists(MISSIONS_DIR):
        print(f"Error: Folder '{MISSIONS_DIR}' not found.")
        return

    init_seed_data()
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM Users LIMIT 1")
    pilot = cursor.fetchone()
    cursor.execute("SELECT id FROM Drones LIMIT 1")
    drone = cursor.fetchone()

    cursor.execute("SELECT file_kmz_path FROM Flight_Plans")
    existing_files = [row[0] for row in cursor.fetchall()]

    files = [f for f in os.listdir(MISSIONS_DIR) if f.endswith('.json')]
    
    for filename in files:
        if filename in existing_files:
            print(f"⏭️  Skipping '{filename}' (Already in DB)")
            continue

        route_name = filename.replace('.json', '').replace('_', ' ').title()
        filepath = os.path.join(MISSIONS_DIR, filename)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            waypoints = extract_waypoints(data)
            
            # Extract details and convert to JSON string
            details_dict = extract_mission_details(data, len(waypoints))
            
            waypoints_json = json.dumps(waypoints)
            details_json = json.dumps(details_dict)

            cursor.execute("INSERT INTO Flight_Plans (route_name, file_kmz_path, waypoints, details) VALUES (?, ?, ?, ?)", 
                           (route_name, filename, waypoints_json, details_json))
            plan_id = cursor.lastrowid

            cursor.execute('''
                INSERT INTO Missions (flight_plan_id, drone_id, pilot_id, status, start_timestamp)
                VALUES (?, ?, ?, 'Pending', CURRENT_TIMESTAMP)
            ''', (plan_id, drone[0], pilot[0]))

            print(f"✅ Auto-Imported: '{route_name}' ({len(waypoints)} waypoints, Max Alt: {details_dict['max_altitude_m']}m)")
            
    conn.commit()
    conn.close()

if __name__ == '__main__':
    print("=== SCANNING FOLDER FOR NEW MISSIONS ===")
    scan_and_import()