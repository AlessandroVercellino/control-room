# routers/admin.py
# Gestione utenti e droni per l'Admin Panel. Riservato al ruolo "responsabile".
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import Drone, SystemLog, User
from security import get_current_user, get_db, get_password_hash, require_role

router = APIRouter(tags=["admin"])


class UserCreate(BaseModel):
    full_name: str
    badge_code: str
    codice_fiscale: str
    role: str
    password: str


class DroneCreate(BaseModel):
    name: str
    hardware_serial: str
    payload_sensors: str = "Not defined"  # Valore di default


class UserOut(BaseModel):
    """Schema di risposta per gli utenti: NON include hashed_password."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    badge_code: str
    codice_fiscale: str
    role: str


class PilotOut(BaseModel):
    """Versione ridotta di UserOut per la tab Pilots della dashboard: niente
    codice fiscale, e accessibile a QUALUNQUE ruolo autenticato (non solo
    responsabile) visto che è solo un roster, non un pannello di gestione."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    badge_code: str
    role: str


@router.get("/api/users", response_model=List[UserOut])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(require_role("responsabile"))):
    """Restituisce tutti gli utenti per i menu a tendina in React (senza hashed_password)"""
    return db.query(User).all()


@router.get("/api/pilots", response_model=List[PilotOut])
def get_pilots(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Roster piloti per la tab Pilots della dashboard operativa (dati ridotti, ogni ruolo può vederlo)."""
    return db.query(User).filter(User.role == "pilota").all()


@router.get("/api/drones")
def get_drones(db: Session = Depends(get_db), current_user: User = Depends(require_role("responsabile"))):
    """Restituisce tutti i droni per i menu a tendina in React (Admin Panel)"""
    return db.query(Drone).all()


@router.get("/api/fleet")
def get_fleet(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Stessi dati di /api/drones ma aperti a qualunque ruolo autenticato: usato
    dalla tab RID della dashboard operativa (roster della flotta, sola lettura)."""
    return db.query(Drone).all()


@router.post("/api/users")
def create_user(user: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("responsabile"))):
    hashed_pwd = get_password_hash(user.password)
    db_user = User(full_name=user.full_name, badge_code=user.badge_code, role=user.role.lower(), hashed_password=hashed_pwd, codice_fiscale=user.codice_fiscale)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # 📝 LOG: Control Room staff modification
    db.add(SystemLog(
        action_type="USER_CREATED",
        description=f"New user registered: {user.full_name} (CF: {user.codice_fiscale}) with role {user.role}"
    ))
    db.commit()
    return {"message": f"User {user.full_name} created successfully!"}


@router.post("/api/drones")
def create_drone(drone: DroneCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("responsabile"))):
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
