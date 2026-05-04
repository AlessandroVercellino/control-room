from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "Control Room Backend Operational"}

@app.get("/api/missions")
def get_missions():
    conn = sqlite3.connect('control_room.db')
    cursor = conn.cursor()
    
    cursor.execute('''
    SELECT Missions.id, Users.full_name, Drones.name, Flight_Plans.route_name, Missions.status, Flight_Plans.waypoints
    FROM Missions
    JOIN Users ON Missions.pilot_id = Users.id
    JOIN Drones ON Missions.drone_id = Drones.id
    JOIN Flight_Plans ON Missions.flight_plan_id = Flight_Plans.id
    ''')
    
    raw_missions = cursor.fetchall()
    conn.close()

    mission_list = []
    for m in raw_missions:
        waypoints_array = json.loads(m[5]) if m[5] else []
        
        mission_list.append({
            "mission_id": m[0],
            "pilot": m[1],
            "drone": m[2],
            "route": m[3],
            "status": m[4],
            "waypoints": waypoints_array
        })
        
    return mission_list