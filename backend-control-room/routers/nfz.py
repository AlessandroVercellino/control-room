# routers/nfz.py
# Gestione delle No-Fly Zone (geofencing PostGIS): upload da file UgCS, disegno
# a mano dalla mappa, lista e disattivazione.
import json
import os
import shutil
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import NoFlyZone, SystemLog, User
from security import get_current_user, get_db, require_role
from ugcs_utils import extract_waypoints_from_ugcs

router = APIRouter(tags=["nfz"])


class NFZCreate(BaseModel):
    name: str
    description: str
    coordinates: List[List[float]]


@router.post("/api/nfz/upload")
async def upload_nfz_file(
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("responsabile"))
):
    """Uploads a JSON file from UgCS to create an active No-Fly Zone"""
    upload_dir = "uploaded_nfz"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Extract coordinates from the JSON file
    # (Using the same extraction logic for now, we will adapt it if UgCS NFZ format differs)
    # 🐛 FIX: extract_waypoints_from_ugcs restituisce una TUPLA (leaflet_points, mqtt_array),
    # non la sola lista di punti — va spacchettata, altrimenti len(coords) misura la tupla (sempre 2).
    coords, _ = extract_waypoints_from_ugcs(file_path)

    if len(coords) < 3:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="Error: The file does not contain a valid polygon (minimum 3 points).")

    # PostGIS requires a polygon to be "closed" (first point must equal the last)
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    # Create the spatial string (WKT) inverting Lat and Lon for PostGIS (Lon Lat)
    polygon_wkt = "POLYGON((" + ", ".join([f"{lon} {lat}" for lat, lon in coords]) + "))"

    db_nfz = NoFlyZone(
        name=name,
        description=description,
        geometry=func.ST_GeomFromText(polygon_wkt, 4326),
        active=True
    )
    db.add(db_nfz)

    db.add(SystemLog(
        action_type="NFZ_UPLOADED",
        description=f"Supervisor uploaded and activated No-Fly Zone: '{name}' via UgCS file."
    ))
    db.commit()

    return {"message": f"No-Fly Zone '{name}' successfully uploaded and activated!"}


@router.get("/api/nfz")
def get_nfz(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieves all active No-Fly Zones for the React map (qualunque ruolo autenticato: serve anche alla mappa operativa)"""
    nfzs = db.query(NoFlyZone.id, NoFlyZone.name, func.ST_AsGeoJSON(NoFlyZone.geometry).label('geojson')).filter(NoFlyZone.active == True).all()

    result = []
    for nfz in nfzs:
        geo_data = json.loads(nfz.geojson)
        coords = [[p[1], p[0]] for p in geo_data['coordinates'][0]]  # From Lon,Lat to Lat,Lon
        result.append({"id": nfz.id, "name": nfz.name, "coordinates": coords})
    return result


@router.delete("/api/nfz/{nfz_id}")
def delete_nfz(nfz_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("responsabile"))):
    """Deactivates an existing No-Fly Zone"""
    nfz = db.query(NoFlyZone).filter(NoFlyZone.id == nfz_id).first()
    if nfz:
        nfz.active = False
        db.add(SystemLog(
            action_type="NFZ_REMOVED",
            description=f"Supervisor deactivated No-Fly Zone: '{nfz.name}'"
        ))
        db.commit()
    return {"message": "No-Fly Zone successfully deactivated."}


@router.post("/api/nfz/draw")
def create_drawn_nfz(nfz: NFZCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("responsabile"))):
    """Salva una No-Fly Zone disegnata a mano dalla mappa React"""
    coords = nfz.coordinates

    if len(coords) < 3:
        raise HTTPException(status_code=400, detail="Errore: Un poligono richiede almeno 3 punti.")

    # PostGIS esige che i poligoni siano "chiusi" (il primo e l'ultimo punto devono coincidere)
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    # Creiamo la stringa WKT. Attenzione: PostGIS vuole prima la Longitudine e poi la Latitudine!
    polygon_wkt = "POLYGON((" + ", ".join([f"{lon} {lat}" for lon, lat in coords]) + "))"

    db_nfz = NoFlyZone(
        name=nfz.name,
        description=nfz.description,
        geometry=func.ST_GeomFromText(polygon_wkt, 4326),
        active=True
    )
    db.add(db_nfz)

    # Registriamo l'azione nell'Audit Trail
    db.add(SystemLog(
        action_type="NFZ_DRAWN",
        description=f"Operatore ha disegnato e attivato manualmente la No-Fly Zone: '{nfz.name}'"
    ))
    db.commit()

    return {"message": f"No-Fly Zone '{nfz.name}' salvata e attivata sul radar!"}
