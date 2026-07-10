# telemetry_manager.py
import asyncio
import paho.mqtt.client as mqtt
from fastapi import WebSocket

# ==========================================
# 📡 GESTORE WEBSOCKET (Il "Ponte" verso React)
# ==========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print("🟢 Nuovo client React connesso alla telemetria!")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print("🔴 Client React disconnesso.")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

# Creiamo l'istanza globale che useremo ovunque
manager = ConnectionManager()
fastapi_loop = None

# ==========================================
# 🚁 CLIENT MQTT (Ascolto dal Drone)
# ==========================================
MQTT_BROKER = "127.0.0.1" # IP dell'onboard computer
MQTT_PORT = 1883
MQTT_USER = "mqtt"
MQTT_PASS = "password"
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connesso al broker MQTT del Drone!")
        # CORRETTO: Il '+' catturerà "drone1", "drone2", "pippo", ecc.
        client.subscribe("fleet/+/telemetry")
    else:
        print(f"⚠️ Errore di connessione MQTT. Codice: {rc}")
def on_message(client, userdata, msg):
    payload = msg.payload.decode("utf-8")
    # Usa il loop asincrono di FastAPI per sparare i dati senza bloccare il server
    if fastapi_loop and manager.active_connections:
        asyncio.run_coroutine_threadsafe(manager.broadcast(payload), fastapi_loop)

def start_mqtt_bridge(loop):
    """Funzione da chiamare nel main.py per accendere i motori"""
    global fastapi_loop
    fastapi_loop = loop
    
    mqtt_client = mqtt.Client()
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start() 
        print("🚀 Ponte MQTT-WebSocket avviato correttamente...")
    except Exception as e:
        print(f"🚨 Impossibile connettersi al broker MQTT: {e}")