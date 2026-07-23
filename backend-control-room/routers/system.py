# routers/system.py
# Endpoint di supporto per la dashboard operativa (tab Security/Networks/Settings):
# chi sono io, log di audit, stato del ponte MQTT. Nessuno di questi tocca dati
# di volo — sono tutti letture, aperte a qualunque utente autenticato.
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import SystemLog, User
from mqtt_publisher import mqtt_client
from security import get_current_user, get_db

router = APIRouter(tags=["system"])


class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    badge_code: str
    role: str


class SystemLogOut(BaseModel):
    id: int
    timestamp: Optional[str]
    action_type: str
    description: str
    user: Optional[str] = None


class SystemStatusOut(BaseModel):
    mqtt_connected: bool


@router.get("/api/me", response_model=MeOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Chi è l'utente loggato — usato dalla tab Settings invece di decodificare il JWT lato client."""
    return current_user


@router.get("/api/logs", response_model=List[SystemLogOut])
def get_logs(limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Registro di audit (SystemLog) per la tab Security: chi ha approvato/bloccato/caricato cosa."""
    logs = (
        db.query(SystemLog)
        .order_by(SystemLog.timestamp.desc())
        .limit(min(limit, 500))
        .all()
    )
    return [
        SystemLogOut(
            id=log.id,
            timestamp=log.timestamp.isoformat() if log.timestamp else None,
            action_type=log.action_type,
            description=log.description,
            user=log.user.full_name if log.user else None,
        )
        for log in logs
    ]


@router.get("/api/system/status", response_model=SystemStatusOut)
def get_system_status(current_user: User = Depends(get_current_user)):
    """Stato di salute del ponte MQTT (client di publish) per la tab Networks."""
    return SystemStatusOut(mqtt_connected=mqtt_client.is_connected())
