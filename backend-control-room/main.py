# main.py
# Entrypoint FastAPI: crea l'app, monta i router e avvia i servizi in background
# (polling Telegram, ponte MQTT/telemetria). La logica delle singole rotte vive
# in routers/; le utility condivise in security.py, ugcs_utils.py, telegram_bot.py,
# mqtt_publisher.py, telemetry_manager.py e database.py.
import asyncio
import threading

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import mqtt_publisher  # noqa: F401 - importato per il side-effect: connette il client MQTT di publish
from telegram_bot import telegram_polling
from telemetry_manager import start_mqtt_bridge
from routers import admin, auth, missions, nfz, system, websocket

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(nfz.router)
app.include_router(missions.router)
app.include_router(system.router)
app.include_router(websocket.router)


# Accendiamo il motore di ascolto appena FastAPI parte!
@app.on_event("startup")
def startup_event():
    print("🚀 Avvio sistema di ascolto Telegram in background...")
    threading.Thread(target=telegram_polling, daemon=True).start()
    start_mqtt_bridge(asyncio.get_running_loop())
