from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, create_engine, JSON, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
from geoalchemy2 import Geometry # Il modulo per usare PostGIS!

# URL di connessione a PostgreSQL (da personalizzare con la tua password locale o server)
DATABASE_URL = "postgresql://admin:admin@localhost:5432/control_room_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- DATI LENTI (RELAZIONALI) ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    badge_code = Column(String, unique=True, nullable=False, index=True)
    codice_fiscale = Column(String, unique=True, nullable=False)
    role = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)

class Drone(Base):
    __tablename__ = "drones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    hardware_serial = Column(String, unique=True, nullable=False)
    status = Column(String, default="IDLE")
    payload_sensors = Column(String, nullable=True)

class FlightPlan(Base):
    __tablename__ = "flight_plans"
    id = Column(Integer, primary_key=True, index=True)
    route_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    # Salviamo i waypoint non come testo, ma come LINESTRING geografica (una linea che unisce punti GPS)
    # 4326 è l'SRID (Spatial Reference System Identifier) standard per GPS WGS84 (Lat/Lon)
    route_geometry = Column(Geometry(geometry_type='LINESTRING', srid=4326)) 
    details = Column(String)

class Mission(Base):
    __tablename__ = "missions"
    id = Column(Integer, primary_key=True, index=True)
    flight_plan_id = Column(Integer, ForeignKey("flight_plans.id"))
    drone_id = Column(Integer, ForeignKey("drones.id"))
    pilot_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="PLANNED") # PLANNED, ACTIVE, COMPLETED, ABORTED
    start_timestamp = Column(DateTime, default=datetime.utcnow)

    # Relazioni per navigare agilmente in Python (es: mission.drone.name)
    plan = relationship("FlightPlan")
    drone = relationship("Drone")
    pilot = relationship("User")

class NoFlyZone(Base):
    __tablename__ = "no_fly_zones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    geometry = Column(Geometry(geometry_type='POLYGON', srid=4326)) # <--- NUOVO
    active = Column(Boolean, default=True)
    description = Column(String, nullable=True)

# --- DATI VELOCI (TIME-SERIES) ---
# Questa è la tabella "Infinita" per la telemetria dell'RTK
class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"
    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), index=True) # Cruciale mettere l'index qui
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Il punto esatto del drone in quel millisecondo (Lat, Lon, Altitudine)
    position = Column(Geometry(geometry_type='POINTZ', srid=4326)) 
    
    # Parametri vitali
    battery_percentage = Column(Float)
    heading = Column(Float) # Direzione del muso del drone
    speed = Column(Float)
    sensor_data = Column(JSON, nullable=True)

    # ==========================================
# 3. AUDIT TRAIL (REGISTRO DI SISTEMA)
# ==========================================

class SystemLog(Base):
    __tablename__ = "system_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Chi ha fatto l'azione (opzionale)
    action_type = Column(String, nullable=False) # Es: LOGIN, MISSION_UPLOADED, ecc.
    description = Column(String, nullable=False) # Dettaglio testuale dell'evento

    user = relationship("User")