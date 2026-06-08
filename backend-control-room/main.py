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

# Importiamo le tabelle dal tuo database
from database import SessionLocal, Drone, Mission, User, FlightPlan

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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Badge o password non validi",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Se la password è giusta, crea il token
    access_token = create_access_token(data={"sub": user.badge_code, "role": user.role})
    
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
    """Restituisce tutti gli utenti (utile per i menu a tendina in React)"""
    return db.query(User).all()

@app.get("/api/drones")
def get_drones(db: Session = Depends(get_db)):
    """Restituisce tutti i droni"""
    return db.query(Drone).all()

@app.post("/api/users")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Crea un nuovo operatore/pilota/responsabile"""
    db_user = User(full_name=user.full_name, badge_code=user.badge_code, role=user.role.lower())
    db.add(db_user)
    db.commit()
    return {"message": f"Utente {user.full_name} creato con successo!"}

@app.post("/api/drones")
def create_drone(drone: DroneCreate, db: Session = Depends(get_db)):
    """Aggiunge un drone alla flotta con il suo payload"""
    db_drone = Drone(
        name=drone.name, 
        hardware_serial=drone.hardware_serial,
        payload_sensors=drone.payload_sensors
    )
    db.add(db_drone)
    db.commit()
    return {"message": f"Drone {drone.name} registrato con payload: {drone.payload_sensors}"}

@app.post("/api/missions/upload")
async def upload_mission(
    route_name: str = Form(...),
    drone_id: int = Form(...),
    pilot_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Riceve il file JSON (Drag&Drop) e crea la missione nel DB"""
    # 1. Crea una cartella fisica sul tuo PC per salvare i file di UgCS se non esiste
    upload_dir = "uploaded_missions"
    os.makedirs(upload_dir, exist_ok=True)
    
    # 2. Salva il file
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 3. Crea il Piano di Volo nel DB
    new_plan = FlightPlan(
        route_name=route_name,
        file_path=file_path,
        details="Caricata tramite Admin Panel"
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan) # Serve per farsi dare l'ID appena creato da PostgreSQL
    
    # 4. Crea la Missione collegando Piano, Drone e Pilota
    new_mission = Mission(
        flight_plan_id=new_plan.id,
        drone_id=drone_id,
        pilot_id=pilot_id,
        status="PLANNED"
    )
    db.add(new_mission)
    db.commit()
    
    return {"message": f"Missione '{route_name}' pronta per il volo!"}


# ==========================================
# 2. ROTTE ESISTENTI (Lettura e Telegram Workflow)
# ==========================================

@app.get("/api/missions")
def get_missions(db: Session = Depends(get_db)):
    missions = db.query(Mission).all()
    result = []
    for m in missions:
        result.append({
            "mission_id": m.id,
            "route": m.plan.route_name if m.plan else "Sconosciuta",
            "status": m.status,
            "drone": m.drone.name if m.drone else "N/A",
            "waypoints": [], 
            "details": {
                "max_altitude_m": 120,
                "total_waypoints": 0,
                "flight_type": "Database Route",
                "source_software": "UgCS"
            }
        })
    return result

@app.post("/api/mission/request-clearance")
def request_clearance(req: ClearanceRequest):
    telegram_status_mock[str(req.mission_id)] = {"pilot_approved": False, "manager_approved": False}
    import threading
    import time
    def simulate_telegram_click():
        time.sleep(4)
        telegram_status_mock[str(req.mission_id)]["pilot_approved"] = True
    threading.Thread(target=simulate_telegram_click).start()
    return {"status": "Notifica inviata"}

@app.post("/api/mission/approve-manager/{mission_id}")
def approve_manager(mission_id: str):
    if mission_id not in telegram_status_mock:
        telegram_status_mock[mission_id] = {"pilot_approved": False, "manager_approved": False}
    telegram_status_mock[mission_id]["manager_approved"] = True
    return {"status": "Manager approvato"}

@app.get("/api/mission/status/{mission_id}")
def get_mission_status(mission_id: str):
    return telegram_status_mock.get(mission_id, {"pilot_approved": False, "manager_approved": False})

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