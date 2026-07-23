# telegram_bot.py
# Bot Telegram: invio richieste di clearance e polling delle risposte
# (approve/reject) del pilota sul campo.
import json
import os
import time

import requests
from dotenv import load_dotenv

from database import Mission, SessionLocal, SystemLog

load_dotenv()

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

LAST_UPDATE_ID = 0  # Serve al server per non rileggere lo stesso click due volte


def send_clearance_request(mission_id, mission_name):
    """Invia il messaggio Telegram con i bottoni Approva/Rifiuta per una missione."""
    mid = str(mission_id)
    messaggio = f"🚨 *FLIGHT CLEARANCE REQUEST*\nMission: {mission_name}\nPlatform awaiting unlock."
    reply_markup = {"inline_keyboard": [[
        {"text": "✅ APPROVE", "callback_data": f"approve_{mid}"},
        {"text": "❌ REJECT", "callback_data": f"reject_{mid}"}
    ]]}

    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        requests.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": messaggio, "parse_mode": "Markdown", "reply_markup": reply_markup})
    except Exception as e:
        print(f"Telegram sending error: {e}")


# ==========================================
# 🎧 TELEGRAM POLLING (With Pilot Decision Logs)
# ==========================================
def telegram_polling():
    global LAST_UPDATE_ID
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"

    while True:
        try:
            # 🛠️ IL FIX: Passiamo allowed_updates in formato JSON
            params = {
                "offset": LAST_UPDATE_ID,
                "timeout": 20,  # Il server di Telegram aspetterà fino a 20 secondi
                "allowed_updates": json.dumps(["message", "callback_query"])
            }

            response = requests.get(url, params=params, timeout=25).json()
            if response.get("ok"):
                for result in response.get("result", []):
                    LAST_UPDATE_ID = result["update_id"] + 1

                    if "callback_query" in result:
                        callback = result["callback_query"]
                        data = callback["data"]
                        callback_id = callback["id"]
                        chat_id = callback["message"]["chat"]["id"]
                        message_id = callback["message"]["message_id"]

                        # Isolate DB session for the background thread
                        db = SessionLocal()

                        if data.startswith("approve_"):
                            mid = data.split("_")[1]
                            mission = None
                            try:
                                mission = db.query(Mission).filter(Mission.id == int(mid)).first()
                            except ValueError:
                                pass
                            if mission:
                                mission.pilot_approved = True
                                mission.pilot_rejected = False

                            # 🚨 TRUE LOG: EXTERNAL APPROVAL
                            db.add(SystemLog(
                                action_type="TELEGRAM_PILOT_APPROVE",
                                description=f"Field pilot granted clearance via Telegram for mission ID: {mid}"
                            ))
                            db.commit()

                            requests.get(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/answerCallbackQuery", params={"callback_query_id": callback_id})
                            requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/editMessageText", json={
                                "chat_id": chat_id, "message_id": message_id,
                                "text": f"✅ *Mission {mid} APPROVED* by Pilot. Control Room unlocked.", "parse_mode": "Markdown"
                            })

                        elif data.startswith("reject_"):
                            mid = data.split("_")[1]
                            mission = None
                            try:
                                mission = db.query(Mission).filter(Mission.id == int(mid)).first()
                            except ValueError:
                                pass
                            if mission:
                                mission.pilot_rejected = True

                            # 🚨 TRUE LOG: REJECTION (Critical for post-flight analysis)
                            db.add(SystemLog(
                                action_type="TELEGRAM_PILOT_REJECT",
                                description=f"WARNING: Field pilot REJECTED clearance for mission ID: {mid}"
                            ))
                            db.commit()

                            requests.get(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/answerCallbackQuery", params={"callback_query_id": callback_id})
                            requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/editMessageText", json={
                                "chat_id": chat_id, "message_id": message_id,
                                "text": f"❌ *Mission {mid} REJECTED* by Pilot. Operation aborted.", "parse_mode": "Markdown"
                            })

                        db.close()  # Close thread session
        except requests.ReadTimeout:
            # È scattato il timeout di 25 secondi. Tutto regolare, il ciclo riparte senza stampare errori.
            pass
        except Exception as e:
            print(f"Telegram polling error: {e}")
        time.sleep(1)
