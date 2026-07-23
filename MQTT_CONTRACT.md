# Contratto MQTT: control-room ↔ onboard-computer

Questo documento esiste perché il formato dei topic non era scritto da
nessuna parte ed è stato scoperto solo leggendo i log del worker di bordo
(`companion_x86`/`companion_aarch64`, cartella `onboard-computer/`, non
gestita da questo repo). Se cambia qualcosa nel firmware del companion,
aggiorna questo file.

## Broker

- Host/porta: `127.0.0.1:1883` (di norma sull'onboard computer collegato al drone)
- Autenticazione: **obbligatoria** per qualunque client, username/password
  definiti in `onboard-computer/config.json` → `mqtt.username`/`mqtt.password`
  e in `backend-control-room/.env` → `MQTT_USERNAME`/`MQTT_PASSWORD`
  (di default `mqtt` / `password`). Se le credenziali non combaciano tra i
  due lati, il client si connette ma i publish non arrivano da nessuna parte
  senza errori evidenti — è il bug risolto in questa sessione.

## Namespace dei topic

Tutti i topic sono prefissati con `fleet/drone{drone_id}/...`, dove
`drone_id` è l'intero definito in `onboard-computer/config.json` →
`drone.id` (es. `drone_id = 1` → prefisso `fleet/drone1/`).

**Attenzione**: gli schema JSON in `uploads/*.schema.json` (es.
`action_emergency.schema.json`) indicano solo `"topic: actions"` — è
**incompleto**. Il topic reale, come confermato dai log del worker
(`Subscribed to topic: fleet/drone1/actions`), è sempre col prefisso
`fleet/drone{id}/`.

| Topic | Direzione | Chi lo usa | Contenuto |
|---|---|---|---|
| `fleet/drone{id}/actions` | Control Room → Drone | `backend-control-room/routers/websocket.py` pubblica, il worker si iscrive | Comandi diretti: RTH, Land, Emergency (vedi `action_*.schema.json`) |
| `fleet/drone{id}/missions` | Control Room → Drone | idem | Missione waypoint (vedi `mission_waypoint.schema.json`) |
| `fleet/drone{id}/telemetry` | Drone → Control Room | il worker pubblica, `backend-control-room/telemetry_manager.py` si iscrive con wildcard `fleet/+/telemetry` | Telemetria live, inoltrata al frontend via `/ws/telemetry` |
| `fleet/drone{id}/avoidance/commands` | Control Room → Drone | il worker si iscrive (visto nei log), **non ancora usato da questo backend** | Comandi al modulo di avoidance — da implementare se/quando serve |

## Come il backend costruisce il topic

In `backend-control-room/routers/websocket.py` (`/ws/commands`), React manda
solo il "topic corto" (`"actions"` o `"missions"`) e il payload; il backend
compone il topic reale leggendo `drone_id` dal payload stesso:

```python
drone_id = payload.get("drone_id", 1)
topic = f"fleet/drone{drone_id}/{short_topic}"
```

Se in futuro servisse controllare più droni con `drone_id` diversi, questo
meccanismo funziona già senza modifiche: basta che il payload React includa
il `drone_id` corretto.

## Formato dei payload

I payload sono validati (concettualmente — non c'è validazione automatica
lato backend oggi) contro gli schema JSON caricati in questa conversazione:

- `action_return_home.schema.json`, `action_land.schema.json`: comando diretto `{drone_id, gcs_id, action: "Return_home"|"Land", parameter: {}}`
- `action_emergency.schema.json`: comando di emergenza generico `{drone_id, gcs_id, action: "Emergency", parameter: {emergency: "Return_home"|"Land"}}` — **quello effettivamente usato oggi** per i pulsanti RTH/Land della Control Room (vedi `App.jsx` → `handleEmergencyAction`)
- `mission_waypoint.schema.json`: missione `{drone_id, gcs_id, mission_type: "Waypoint", mission: [{Waypoint Number, Latitude, Longitude, Altitude}, ...]}` — tutti i valori dentro `mission[]` sono **stringhe**, non numeri
- `action_hover.schema.json`, `action_move.schema.json`, `action_rotate.schema.json`, `action_stop.schema.json`, `action_takeoff.schema.json`, `action_goto.schema.json`, `mission_hotpoint.schema.json`: caricati ma **non ancora implementati** in nessuna rotta del backend o pulsante del frontend.

## Debug rapido

Per vedere il traffico raw sul broker (utile la prossima volta che "il
messaggio arriva ma non viene eseguito"):

```
mosquitto_sub -h 127.0.0.1 -p 1883 -u mqtt -P password -t 'fleet/#' -v
```

oppure con MQTT Explorer, sottoscrivendosi a `fleet/#` invece che al singolo
topic — così si vede subito su quale sotto-topic arriva davvero ogni messaggio.
