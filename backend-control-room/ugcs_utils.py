# ugcs_utils.py
# Parsing dei file di missione/rotta esportati da UgCS.
import json
import math


def extract_waypoints_from_ugcs(filepath, default_altitude=20.0):
    leaflet_points = []
    mqtt_mission_array = []
    waypoint_counter = 1

    try:
        with open(filepath, 'r') as f:
            data = json.load(f)

        def search_points(obj):
            nonlocal waypoint_counter
            if not obj:
                return

            if isinstance(obj, dict):
                if 'latitude' in obj and 'longitude' in obj:
                    # UgCS usa i radianti, li convertiamo in gradi
                    lat = obj['latitude'] * (180 / math.pi)
                    lon = obj['longitude'] * (180 / math.pi)

                    # 1. Punto per la mappa React (Leaflet)
                    leaflet_points.append([lat, lon])

                    # 2. Cerchiamo l'altitudine nel file, altrimenti usiamo il default
                    alt = obj.get('altitude', default_altitude)

                    # 3. Punto per il broker MQTT (TUTTO in formato stringa come da schema)
                    mqtt_mission_array.append({
                        "Waypoint Number": str(waypoint_counter),
                        "Latitude": str(lat),
                        "Longitude": str(lon),
                        "Altitude": str(alt)
                    })
                    waypoint_counter += 1

                for v in obj.values():
                    search_points(v)
            elif isinstance(obj, list):
                for item in obj:
                    search_points(item)

        search_points(data)

        # Ritorniamo entrambe le liste!
        return leaflet_points, mqtt_mission_array

    except Exception as e:
        print(f"⚠️ Errore lettura file UgCS: {e}")
        return [], []
