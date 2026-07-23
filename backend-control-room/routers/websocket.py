# routers/websocket.py
# Canali realtime verso React: telemetria in ascolto (broadcast dal drone) e
# comandi in uscita (missione/emergenza pubblicati sul broker MQTT).
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from mqtt_publisher import mqtt_client
from telemetry_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# --- WEBSOCKET COMANDI (Ponte tra React e il Drone) ---
@router.websocket("/ws/commands")
async def websocket_commands(websocket: WebSocket):
    await websocket.accept()
    print("🟢 Control Room React connessa al canale comandi")

    try:
        while True:
            # Riceviamo il JSON dalla tua modale o dalla sidebar
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("action") == "publish_mqtt":
                short_topic = message.get("topic")  # "actions" o "missions", inviato da React
                payload = message.get("payload")

                # 🎯 Il worker di bordo (companion) si iscrive a "fleet/drone{id}/<topic>",
                # non al topic "nudo": vedi log worker -> "Subscribed to topic: fleet/drone1/actions".
                drone_id = payload.get("drone_id", 1) if isinstance(payload, dict) else 1
                topic = f"fleet/drone{drone_id}/{short_topic}"

                # Convertiamo l'oggetto Python in una stringa JSON per MQTT
                payload_str = json.dumps(payload)

                # 🔎 Verifichiamo che il client sia davvero connesso PRIMA di pubblicare:
                # se il broker ha appena "kickato" il client (es. session taken over),
                # una publish alla cieca va persa senza che nessuno se ne accorga.
                if not mqtt_client.is_connected():
                    print(f"⚠️ Client MQTT non connesso: tentativo di riconnessione prima di pubblicare su '{topic}'...")
                    try:
                        mqtt_client.reconnect()
                    except Exception as reconnect_err:
                        print(f"🔴 Riconnessione al broker MQTT fallita: {reconnect_err}")
                        await websocket.send_text(json.dumps({
                            "status": "error",
                            "detail": f"Broker MQTT non raggiungibile, comando su '{topic}' NON inviato."
                        }))
                        continue

                # 🚀 SPARIAMO IL COMANDO AL DRONE VIA MQTT (e aspettiamo conferma dal client, max 3s)
                info = mqtt_client.publish(topic, payload_str, qos=1)
                info.wait_for_publish(timeout=3)

                if info.is_published():
                    print(f"📡 ORDINE INVIATO AL DRONE (Topic: {topic})")
                    print(f"📦 Dettagli: {payload_str}")
                    await websocket.send_text(json.dumps({"status": "ok", "topic": topic}))
                else:
                    print(f"🔴 Publish FALLITA su topic '{topic}' (rc={info.rc})")
                    await websocket.send_text(json.dumps({
                        "status": "error",
                        "detail": f"Publish su '{topic}' non confermata dal broker (rc={info.rc})."
                    }))

    except WebSocketDisconnect:
        print("🔴 Connessione comandi chiusa da React (Lancio completato)")
    except Exception as e:
        print(f"⚠️ Errore di elaborazione nel WebSocket comandi: {e}")
