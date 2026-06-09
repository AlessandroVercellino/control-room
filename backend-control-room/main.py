import os
import shutil
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from fastapi import HTTPException, status
import jwt
import json
import math
import requests
import threading
import time
# Importiamo le tabelle dal tuo database
from database import SessionLocal, Drone, Mission, User, FlightPlan, SystemLog

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
# ==========================================
# 🔐 GESTIONE SICUREZZA (JWT & Password)
# ==========================================
SECRET_KEY = "la_tua_chiave_segreta_super_sicura_cambiala_in_produzione"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # Il token dura 24 ore

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# ---- ROTTA DI LOGIN (Quella che React stava cercando!) ----
@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Cerca l'utente usando il badge_code come 'username'
    user = db.query(User).filter(User.badge_code == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):

       # 🚨 FAIL LOG: Someone is trying to force access
        failed_log = SystemLog(
            action_type="SECURITY_ALERT",
            description=f"FAILED login attempt for Operator ID: {form_data.username}"
        )
        db.add(failed_log)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid badge code or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Se la password è giusta, crea il token
    access_token = create_access_token(data={"sub": user.badge_code, "role": user.role})

   # ✅ SUCCESS LOG: Tracking room entry
    new_log = SystemLog(
        user_id=user.id, 
        action_type="USER_LOGIN", 
        description=f"Operator {user.full_name} logged in with role: {user.role.upper()}"
    )
    db.add(new_log)
    db.commit()
    
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}
# ==========================================
# MODELLI PYDANTIC (Per validare i dati da React)
# ==========================================
class ClearanceRequest(BaseModel):
    mission_id: str | int
    mission_name: str

class UserCreate(BaseModel):
    full_name: str
    badge_code: str
    role: str
    password: str

class DroneCreate(BaseModel):
    name: str
    hardware_serial: str
    payload_sensors: str = "Not defined" # Valore di default

telegram_status_mock = {}

# ==========================================
# 1. NUOVE ROTTE PER L'ADMIN PANEL (Inserimento Dati)
# ==========================================

@app.get("/api/users")
def get_users(db: Session = Depends(get_db)):
    """Restituisce tutti gli utenti per i menu a tendina in React"""
    return db.query(User).all()

@app.get("/api/drones")
def get_drones(db: Session = Depends(get_db)):
    """Restituisce tutti i droni per i menu a tendina in React"""
    return db.query(Drone).all()

@app.post("/api/users")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    hashed_pwd = get_password_hash(user.password)
    db_user = User(full_name=user.full_name, badge_code=user.badge_code, role=user.role.lower(), hashed_password=hashed_pwd)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # 📝 LOG: Control Room staff modification
    db.add(SystemLog(
        action_type="USER_CREATED",
        description=f"New user registered in the system: {user.full_name} with role {user.role}"
    ))
    db.commit()
    return {"message": f"User {user.full_name} created successfully!"}

@app.post("/api/drones")
def create_drone(drone: DroneCreate, db: Session = Depends(get_db)):
    db_drone = Drone(name=drone.name, hardware_serial=drone.hardware_serial, payload_sensors=drone.payload_sensors)
    db.add(db_drone)
    db.commit()
    db.refresh(db_drone)

    # 📝 LOG: Hardware fleet modification
    db.add(SystemLog(
        action_type="DRONE_REGISTERED",
        description=f"New vehicle added to the fleet: {drone.name} | Payload: {drone.payload_sensors}"
    ))
    db.commit()
    return {"message": f"Drone {drone.name} registered successfully!"}

@app.post("/api/missions/upload")
async def upload_mission(
    route_name: str = Form(...),
    drone_id: int = Form(...),
    pilot_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    upload_dir = "uploaded_missions"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    new_plan = FlightPlan(route_name=route_name, file_path=file_path, details="Uploaded via Admin Panel")
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    
    new_mission = Mission(flight_plan_id=new_plan.id, drone_id=drone_id, pilot_id=pilot_id, status="PLANNED")
    db.add(new_mission)
    db.commit()
    db.refresh(new_mission)
    
    # 📝 LOG: New flight plan registered
    db.add(SystemLog(
        user_id=pilot_id,
        action_type="MISSION_UPLOADED",
        description=f"UgCS flight plan '{route_name}' uploaded (Mission ID: {new_mission.id}). Assigned to drone ID {drone_id}"
    ))
    db.commit()
    
    return {"message": f"Mission '{route_name}' ready for flight!"}


# ==========================================
# 2. ROTTE ESISTENTI (Lettura e Telegram Workflow)
# ==========================================

# Funzione tradotta dal tuo React a Python per leggere i file UgCS
def extract_waypoints_from_ugcs(filepath):
    points = []
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
            
        def search_points(obj):
            if not obj: return
            if isinstance(obj, dict):
                if 'latitude' in obj and 'longitude' in obj:
                    # UgCS usa i radianti, li convertiamo in gradi per la mappa Leaflet
                    lat = obj['latitude'] * (180 / math.pi)
                    lon = obj['longitude'] * (180 / math.pi)
                    points.append([lat, lon])
                for v in obj.values():
                    search_points(v)
            elif isinstance(obj, list):
                for item in obj:
                    search_points(item)
                    
        search_points(data)
        return points
    except Exception as e:
        print(f"⚠️ Errore lettura file UgCS: {e}")
        return []

@app.get("/api/missions")
def get_missions(db: Session = Depends(get_db)):
    missions = db.query(Mission).all()
    result = []
    for m in missions:

        waypoints = extract_waypoints_from_ugcs(m.plan.file_path) if m.plan else []

        result.append({
            "mission_id": m.id,
            "route": m.plan.route_name if m.plan else "Sconosciuta",
            "status": m.status,
            "drone": m.drone.name if m.drone else "N/A",
            "waypoints": waypoints,
            "details": {
                "max_altitude_m": 120,
                "total_waypoints": len(waypoints),
                "flight_type": "Database Route",
                "source_software": "UgCS"
            }
        })
    return result

# --- INSERISCI I TUOI DATI VERI QUI ---
TELEGRAM_BOT_TOKEN = "8817765386:AAHUHLAMj88jj6OhEhPjWjChM8gJ1zJr8Ts"
TELEGRAM_CHAT_ID = "966691579"


telegram_status_mock = {}
LAST_UPDATE_ID = 0  # Serve al server per non rileggere lo stesso click due volte

# ==========================================
# 🎧 TELEGRAM POLLING (With Pilot Decision Logs)
# ==========================================
def telegram_polling():
    global LAST_UPDATE_ID
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    
    while True:
        try:
            response = requests.get(url, params={"offset": LAST_UPDATE_ID, "timeout": 5}, timeout=10).json()
            if response.get("ok"):
                for result in response.get("result", []):
                    LAST_UPDATE_ID = result["update_id"] + 1

                    if "callback_query" in result:
                        callback = result["callback_query"]
                        data = callback["data"]
                        callback_id = callback["id"]
                        chat_id = callback["message"]["chat"]["id"]
                        message_id = callback["message"]["message_id"]
                        
                        # Isolate DB session for the background thread
                        db = SessionLocal()

                        if data.startswith("approve_"):
                            mid = data.split("_")[1]
                            if mid in telegram_status_mock:
                                telegram_status_mock[mid]["pilot_approved"] = True
                            
                            # 🚨 TRUE LOG: EXTERNAL APPROVAL
                            db.add(SystemLog(
                                action_type="TELEGRAM_PILOT_APPROVE",
                                description=f"Field pilot granted clearance via Telegram for mission ID: {mid}"
                            ))
                            db.commit()

                            requests.get(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/answerCallbackQuery", params={"callback_query_id": callback_id})
                            requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/editMessageText", json={
                                "chat_id": chat_id, "message_id": message_id,
                                "text": f"✅ *Mission {mid} APPROVED* by Pilot. Control Room unlocked.", "parse_mode": "Markdown"
                            })

                        elif data.startswith("reject_"):
                            mid = data.split("_")[1]
                            
                            # 🚨 TRUE LOG: REJECTION (Critical for post-flight analysis)
                            db.add(SystemLog(
                                action_type="TELEGRAM_PILOT_REJECT",
                                description=f"WARNING: Field pilot REJECTED clearance for mission ID: {mid}"
                            ))
                            db.commit()

                            requests.get(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/answerCallbackQuery", params={"callback_query_id": callback_id})
                            requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/editMessageText", json={
                                "chat_id": chat_id, "message_id": message_id,
                                "text": f"❌ *Mission {mid} REJECTED* by Pilot. Operation aborted.", "parse_mode": "Markdown"
                            })
                        
                        db.close() # Close thread session
        except Exception as e:
            print(f"Telegram polling error: {e}")
        time.sleep(1)

# Accendiamo il motore di ascolto appena FastAPI parte!
@app.on_event("startup")
def startup_event():
    print("🚀 Avvio sistema di ascolto Telegram in background...")
    threading.Thread(target=telegram_polling, daemon=True).start()

# ==========================================
# 🚀 WORKFLOW ROUTES (With Operational Logs)
# ==========================================

@app.post("/api/mission/request-clearance")
def request_clearance(req: ClearanceRequest, db: Session = Depends(get_db)):
    mid = str(req.mission_id)
    telegram_status_mock[mid] = {"pilot_approved": False, "manager_approved": False}
    
    # 📝 LOG: Start of the authorization chain
    db.add(SystemLog(
        action_type="CLEARANCE_REQUESTED",
        description=f"Clearance procedure initiated for mission '{req.mission_name}' (ID: {mid}). Notification sent to pilot."
    ))
    db.commit()

    messaggio = f"🚨 *FLIGHT CLEARANCE REQUEST*\nMission: {req.mission_name}\nPlatform awaiting unlock."
    reply_markup = {"inline_keyboard": [[
        {"text": "✅ APPROVE", "callback_data": f"approve_{mid}"},
        {"text": "❌ REJECT", "callback_data": f"reject_{mid}"}
    ]]}
    
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": messaggio, "parse_mode": "Markdown", "reply_markup": reply_markup})
    except Exception as e:
        print(f"Telegram sending error: {e}")

    return {"status": "Notification sent successfully"}

@app.post("/api/mission/approve-manager/{mission_id}")
def approve_manager(mission_id: str, db: Session = Depends(get_db)):
    mid = str(mission_id)
    if mid not in telegram_status_mock:
        telegram_status_mock[mid] = {"pilot_approved": False, "manager_approved": False}
    telegram_status_mock[mid]["manager_approved"] = True
    
    # 📝 LOG: Room Manager Digital Signature
    db.add(SystemLog(
        action_type="MANAGER_ROOM_APPROVE",
        description=f"Control Room Manager digitally signed approval for mission ID: {mid}"
    ))
    db.commit()
    return {"status": "Manager approval recorded"}

@app.get("/api/mission/status/{mission_id}")
def get_mission_status(mission_id: str):
    mid = str(mission_id)
    return telegram_status_mock.get(mid, {"pilot_approved": False, "manager_approved": False})
# ==========================================
# WEBSOCKET
# ==========================================
@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(data)
    except WebSocketDisconnect:
        pass