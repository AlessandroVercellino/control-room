from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
import jwt
import sqlite3
import json
from datetime import datetime, timedelta

# --- CONFIGURAZIONI DI SICUREZZA ---
SECRET_KEY = "chiave-segreta-control-room-iplom"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120
DB_PATH = "control_room.db" # Usiamo il TUO database esistente!

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELLI DATI ---
class UserRegister(BaseModel):
    username: str
    password: str
    role: str

# --- INIZIALIZZAZIONE TABELLA AUTENTICAZIONE ---
def init_db():
    # Creiamo la tabella auth_users per non toccare la tua tabella Users (piloti)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS auth_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL
            )
        """)
        conn.commit()

init_db()

# --- FUNZIONI DI SICUREZZA (JWT e Hashing) ---
def get_password_hash(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise HTTPException(status_code=401, detail="Token non valido")
        return {"username": username, "role": role}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token scaduto")

# --- ENDPOINT DI BASE E LOGIN ---
@app.get("/")
def read_root():
    return {"status": "online", "message": "Control Room Backend Operational"}

@app.post("/api/auth/register")
async def register_user(user_data: UserRegister):
    if user_data.role not in ["responsabile", "operatore", "spettatore"]:
        raise HTTPException(status_code=400, detail="Ruolo non valido")
    
    hashed_password = get_password_hash(user_data.password)
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO auth_users (username, password_hash, role) VALUES (?, ?, ?)",
                (user_data.username, hashed_password, user_data.role)
            )
            conn.commit()
        return {"status": "success", "message": f"Utente {user_data.username} creato!"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username già esistente")

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM auth_users WHERE username = ?", (form_data.username,))
        user = cursor.fetchone()
    
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenziali errate")
    
    access_token = create_access_token(data={"sub": user["username"], "role": user["role"]})
    return {"access_token": access_token, "token_type": "bearer", "role": user["role"]}


# --- I TUOI ENDPOINT DEL DRONE (Protetti) ---

# Ora get_missions è protetto: solo chi ha fatto il login può vedere i piani di volo!
@app.get("/api/missions")
def get_missions(current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
    SELECT Missions.id, Users.full_name, Drones.name, Flight_Plans.route_name, Missions.status, Flight_Plans.waypoints, Flight_Plans.details
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
        details_obj = json.loads(m[6]) if m[6] else {}
        
        mission_list.append({
            "mission_id": m[0],
            "pilot": m[1],
            "drone": m[2],
            "route": m[3],
            "status": m[4],
            "waypoints": waypoints_array,
            "details": details_obj
        })
        
    return mission_list

# Esempio di endpoint protetto solo per Responsabili e Operatori
@app.post("/api/emergency/rth")
async def trigger_rth(current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "spettatore":
        raise HTTPException(status_code=403, detail="Azione negata. Spettatore non autorizzato.")
    return {"status": "success", "message": f"RTH avviato da {current_user['username']}"}