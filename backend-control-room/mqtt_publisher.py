# mqtt_publisher.py
# Client MQTT dedicato alla pubblicazione dei comandi verso il drone (topic
# fleet/drone{id}/actions|missions). Usa le stesse credenziali del client di
# telemetria (telemetry_manager.py) perché il broker le richiede per qualunque connessione.
import paho.mqtt.client as mqtt

from telemetry_manager import MQTT_USER, MQTT_PASS

BROKER_ADDRESS = "127.0.0.1"
BROKER_PORT = 1883

mqtt_client = mqtt.Client(client_id="control_room_backend")
mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)


def _on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ [Publish Client] Connesso al broker MQTT su {BROKER_ADDRESS}:{BROKER_PORT}")
    else:
        print(f"⚠️ [Publish Client] Connessione RIFIUTATA dal broker, codice: {rc}")


def _on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"🔴 [Publish Client] Disconnessione INATTESA dal broker (codice: {rc}). Riconnessione automatica in corso...")
    else:
        print("🔴 [Publish Client] Disconnesso dal broker MQTT.")


mqtt_client.on_connect = _on_connect
mqtt_client.on_disconnect = _on_disconnect

try:
    mqtt_client.connect(BROKER_ADDRESS, BROKER_PORT)
    mqtt_client.loop_start()
    print(f"✅ Trasmettitore MQTT connesso al broker su {BROKER_ADDRESS}:{BROKER_PORT}")
except Exception as e:
    print(f"⚠️ Impossibile connettersi al broker MQTT: {e}")
