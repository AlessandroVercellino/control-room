# routers/missions.py
# Upload piani di volo (con controllo geofencing), lista missioni, e workflow
# di autorizzazione al lancio (richiesta clearance -> pilota via Telegram +
# responsabile in sala -> pronto al lancio).
import os
import shutil

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import FlightPlan, Mission, NoFlyZone, SystemLog, User
from security import get_current_user, get_db, require_role
from telegram_bot import send_clearance_request
from ugcs_utils import extract_waypoints_from_ugcs

router = APIRouter(tags=["missions"])


class ClearanceRequest(BaseModel):
    mission_id: str | int
    mission_name: str


# ==========================================
# 🚀 UPLOAD MISSIONE (Con Controllo Radar PostGIS)
# ==========================================
@router.post("/api/missions/upload")
async def upload_mission(
    route_name: str = Form(...),
    drone_id: int = Form(...),
    pilot_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("responsabile"))
):
    upload_dir = "uploaded_missions"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 1. Estrazione punti
    # 🐛 FIX: extract_waypoints_from_ugcs restituisce una TUPLA (leaflet_points, mqtt_array),
    # non la sola lista di punti — va spacchettata, altrimenti len(points) misura la tupla (sempre 2)
    # e lo spacchettamento "for lat, lon in points" sotto avrebbe rotto per qualunque rotta
    # con un numero di waypoint diverso da 2.
    points, mqtt_array = extract_waypoints_from_ugcs(file_path)
    if len(points) < 2:
         raise HTTPException(status_code=400, detail="Errore: Il file non contiene waypoint validi.")

    # 2. Creazione linea spaziale
    linestring_wkt = "LINESTRING(" + ", ".join([f"{lon} {lat}" for lat, lon in points]) + ")"

    # 3. CONTROLLO GEO-FENCING (ST_Intersects)
    intersecting_nfz = db.query(NoFlyZone).filter(
        NoFlyZone.active == True,
        func.ST_Intersects(NoFlyZone.geometry, func.ST_GeomFromText(linestring_wkt, 4326))
    ).first()

    if intersecting_nfz:
        # LOG di Sicurezza
        db.add(SystemLog(
            user_id=pilot_id,
            action_type="SECURITY_ALERT_NFZ",
            description=f"BLOCKED: Route '{route_name}' intersects active NFZ '{intersecting_nfz.name}'"
        ))
        db.commit()

        # Elimina il file json pericoloso
        os.remove(file_path)

        raise HTTPException(
            status_code=403,
            detail=f"🚨 PIANO DI VOLO BLOCCATO: La traiettoria entra nella No-Fly Zone '{intersecting_nfz.name}'."
        )

    # 4. SALVATAGGIO MISSIONE SICURA
    # I waypoint vengono salvati qui (waypoints_json), non solo il percorso del file:
    # file_path resta come backup, ma GET /api/missions non lo rilegge più a runtime.
    new_plan = FlightPlan(
        route_name=route_name,
        file_path=file_path,
        details="Uploaded via Admin Panel",
        route_geometry=func.ST_GeomFromText(linestring_wkt, 4326),
        waypoints_json={"leaflet_points": points, "mqtt_mission_array": mqtt_array}
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)

    new_mission = Mission(flight_plan_id=new_plan.id, drone_id=drone_id, pilot_id=pilot_id, status="PLANNED")
    db.add(new_mission)
    db.commit()
    db.refresh(new_mission)

    db.add(SystemLog(
        user_id=pilot_id,
        action_type="MISSION_UPLOADED",
        description=f"Safe flight plan '{route_name}' uploaded (Mission ID: {new_mission.id}). NFZ check: CLEAR."
    ))
    db.commit()

    return {"message": f"Missione '{route_name}' approvata dal radar e pronta!"}


@router.get("/api/missions")
def get_missions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    missions = db.query(Mission).all()
    result = []
    for m in missions:
        # Inizializziamo le due liste vuote
        leaflet_points = []
        mqtt_array = []

        # Se c'è il piano, i waypoint vengono letti dal database (salvati una volta
        # all'upload in waypoints_json), non più riparsando il file ad ogni richiesta.
        # Fallback sul file solo per piani caricati prima di questa modifica, che non
        # hanno ancora waypoints_json valorizzato.
        if m.plan and m.plan.waypoints_json:
            leaflet_points = m.plan.waypoints_json.get("leaflet_points", [])
            mqtt_array = m.plan.waypoints_json.get("mqtt_mission_array", [])
        elif m.plan:
            leaflet_points, mqtt_array = extract_waypoints_from_ugcs(m.plan.file_path)

        is_blocked = False
        blocked_by = ""

        # Controllo No-Fly Zone (perfetto così com'è)
        if m.plan and m.plan.route_geometry:
            violation = db.query(NoFlyZone).filter(
                NoFlyZone.active == True,
                func.ST_Intersects(NoFlyZone.geometry, m.plan.route_geometry)
            ).first()

            if violation:
                is_blocked = True
                blocked_by = violation.name

        result.append({
            "mission_id": m.id,
            "route": m.plan.route_name if m.plan else "Sconosciuta",
            "status": m.status,
            "drone": m.drone.name if m.drone else "N/A",
            "pilot_id": m.pilot_id,
            "pilot": m.pilot.full_name if m.pilot else "N/A",

            # --- LE DUE NUOVE CHIAVI PER IL FRONTEND ---
            "waypoints": leaflet_points,          # React lo usa per tracciare la Polyline sulla mappa
            "mqtt_payload": mqtt_array,           # React lo salva in memoria per inviarlo al click del tasto "Start"

            "is_blocked": is_blocked,
            "blocked_by": blocked_by,
            "details": {
                "max_altitude_m": 120,
                "total_waypoints": len(leaflet_points),
                "flight_type": "Database Route",
                "source_software": "UgCS"
            }
        })
    return result


# ==========================================
# 🚀 WORKFLOW ROUTES (With Operational Logs)
# ==========================================

@router.post("/api/mission/request-clearance")
def request_clearance(req: ClearanceRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    mid = str(req.mission_id)

    try:
        mission = db.query(Mission).filter(Mission.id == int(mid)).first()
    except ValueError:
        mission = None
    if not mission:
        raise HTTPException(status_code=404, detail=f"Mission {mid} not found")

    # Reset dello stato di autorizzazione ad ogni nuova richiesta di clearance
    mission.pilot_approved = False
    mission.manager_approved = False
    mission.pilot_rejected = False

    # 📝 LOG: Start of the authorization chain
    db.add(SystemLog(
        action_type="CLEARANCE_REQUESTED",
        description=f"Clearance procedure initiated for mission '{req.mission_name}' (ID: {mid}). Notification sent to pilot."
    ))
    db.commit()

    send_clearance_request(mid, req.mission_name)

    return {"status": "Notification sent successfully"}


@router.post("/api/mission/approve-manager/{mission_id}")
def approve_manager(mission_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_role("responsabile"))):
    mid = str(mission_id)
    try:
        mission = db.query(Mission).filter(Mission.id == int(mid)).first()
    except ValueError:
        mission = None
    if not mission:
        raise HTTPException(status_code=404, detail=f"Mission {mid} not found")

    mission.manager_approved = True

    # 📝 LOG: Room Manager Digital Signature
    db.add(SystemLog(
        action_type="MANAGER_ROOM_APPROVE",
        description=f"Control Room Manager digitally signed approval for mission ID: {mid}"
    ))
    db.commit()
    return {"status": "Manager approval recorded"}


@router.get("/api/mission/status/{mission_id}")
def get_mission_status(mission_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    mid = str(mission_id)
    try:
        mission = db.query(Mission).filter(Mission.id == int(mid)).first()
    except ValueError:
        mission = None
    if not mission:
        return {"pilot_approved": False, "manager_approved": False, "pilot_rejected": False}
    return {
        "pilot_approved": mission.pilot_approved,
        "manager_approved": mission.manager_approved,
        "pilot_rejected": mission.pilot_rejected,
    }
