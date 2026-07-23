// src/App.jsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import Login from './Login';
import WeatherScreen from './WeatherScreen';
import MissionModal from './components/MissionModal';
import MapPanel from './components/MapPanel';
import Sidebar from './components/Sidebar';
import AdminPanel from './components/AdminPanel';
import { API_BASE_URL, WS_BASE_URL } from './config';

// Lista dei protocolli di emergenza (comandi diretti al drone via MQTT)
const emergencyProtocols = [
  {
    id: "E2",
    name: "Direct Return to Home (RTH)",
    type: "action",
    actionType: "Return_home"
  },
  {
    id: "E3",
    name: "Immediate Landing (Land)",
    type: "action",
    actionType: "Land"
  }
];

export default function App() {

  // 🔒 CONTROLLO MULTI-SCHERMO PROTETTO
  if (window.location.pathname === '/meteo' || window.location.hash === '#/meteo') {
    const savedToken = localStorage.getItem('control_room_token');
    if (!savedToken) {
      return (
        <div className="h-screen w-screen bg-black text-red-500 flex flex-col items-center justify-center font-mono p-4 border-4 border-red-900">
          <div className="text-3xl font-black tracking-widest animate-pulse">SECURITY VIOLATION</div>
          <div className="text-sm text-neutral-500 mt-2 uppercase tracking-wider">Access denied. Initialize the connection from the main Control Room.</div>
        </div>
      );
    }
    return <WeatherScreen />;
  }

  const [activeMission, setActiveMission] = useState(null);
  const [serverMissions, setServerMissions] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const mapCenter = [44.437475, 8.880381];
  const [token, setToken] = useState(localStorage.getItem('control_room_token') || null);
  const [userRole, setUserRole] = useState(localStorage.getItem('control_room_role') || null);

  const handleLoginSuccess = (jwtToken, role) => {
    setToken(jwtToken);
    setUserRole(role);
    localStorage.setItem('control_room_token', jwtToken);
    localStorage.setItem('control_room_role', role);
  };

  const handleLogout = () => {
    setToken(null);
    setUserRole(null);
    localStorage.removeItem('control_room_token');
    localStorage.removeItem('control_room_role');
  };

  // --- LOGICA TELEGRAM & WORKFLOW LANCIO ---
  const [missionPhase, setMissionPhase] = useState('IDLE');
  const [approvals, setApprovals] = useState({ pilot: false, manager: false });

  const handleRequestDispatch = async (e) => {
    if (e) e.stopPropagation();
    setMissionPhase('AWAITING_APPROVAL');
    setApprovals({ pilot: false, manager: false });
    try {
      await fetch(`${API_BASE_URL}/api/mission/request-clearance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ mission_id: activeMission.id, mission_name: activeMission.name })
      });
    } catch (err) { console.error("Errore Telegram:", err); }
  };

  const handleManagerApprove = async (e) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`${API_BASE_URL}/api/mission/approve-manager/${activeMission.id}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      setApprovals(prev => ({ ...prev, manager: true }));
    } catch (err) { console.error(err); }
  };

  // 🔥 1. INVIO REALE MISSIONE WAYPOINT VIA WEBSOCKET (MQTT)
  const handleUploadAndLaunch = (e) => {
    if (e) e.stopPropagation();

    if (!activeMission || !activeMission.mqtt_payload) {
      console.error("⚠️ Impossibile inviare: payload MQTT mancante nella missione attiva.");
      alert("Error: no valid waypoint data available to send to the drone.");
      return;
    }

    // Costruiamo il JSON finale rispettando lo schema mission_waypoint.schema_2.json[cite: 11]
    const payloadToDrone = {
      drone_id: 1, 
      gcs_id: 1,   
      mission_type: "Waypoint", 
      mission: activeMission.mqtt_payload 
    };

    // Inviamo il comando e ASPETTIAMO la conferma reale dal backend (publish_mqtt riuscita o no)
    const wsCommand = new WebSocket(`${WS_BASE_URL}/ws/commands`);

    wsCommand.onopen = () => {
      console.log("🟢 Connesso al canale comandi WebSocket. Invio Waypoint in corso...");
      wsCommand.send(JSON.stringify({
        action: "publish_mqtt",
        topic: "missions",
        payload: payloadToDrone
      }));
      console.log("🚀 PAYLOAD WAYPOINT INVIATO AL BACKEND:", payloadToDrone);
    };

    wsCommand.onmessage = (event) => {
      const response = JSON.parse(event.data);
      wsCommand.close();

      if (response.status === "ok") {
        setMissionPhase('IDLE');
        setShowDetailsModal(false);
        alert("FLIGHT PLAN UPLOADED TO THE DRONE VIA MQTT!");
      } else {
        console.error("🔴 Publish MQTT fallita:", response.detail);
        alert(`SEND FAILED: ${response.detail || "the MQTT broker did not confirm publication."}`);
      }
    };

    wsCommand.onerror = (err) => {
      console.error("🔴 Errore durante l'invio del comando di volo:", err);
      alert("WebSocket connection error during launch.");
    };
  };

  // 🔥 2. GESTIONE AZIONI DI EMERGENZA (RTH / LAND) - invio diretto pacchetto Emergency via MQTT
  const handleEmergencyAction = (protocol) => {
    const emergencyPayload = {
      drone_id: 1,
      gcs_id: 1,
      action: "Emergency",
      parameter: {
        emergency: protocol.actionType // "Return_home" o "Land"
      }
    };

    const wsCommand = new WebSocket(`${WS_BASE_URL}/ws/commands`);

    wsCommand.onopen = () => {
      wsCommand.send(JSON.stringify({
        action: "publish_mqtt",
        topic: "actions",
        payload: emergencyPayload
      }));
      console.log("🚨 COMANDO DI EMERGENZA INVIATO AL BACKEND:", emergencyPayload);
    };

    wsCommand.onmessage = (event) => {
      const response = JSON.parse(event.data);
      wsCommand.close();

      if (response.status === "ok") {
        alert(`EMERGENCY COMMAND (${protocol.name}) SENT TO THE DRONE!`);
      } else {
        console.error("🔴 Publish MQTT emergenza fallita:", response.detail);
        alert(`EMERGENCY COMMAND NOT SENT: ${response.detail || "the MQTT broker did not confirm publication."}`);
      }
    };

    wsCommand.onerror = (err) => {
      console.error("🔴 Errore WebSocket comando emergenza:", err);
      alert("WebSocket connection error while sending the emergency command.");
    };
  };

  // Polling approvazioni Telegram
  useEffect(() => {
    let interval = null;
    if (missionPhase === 'AWAITING_APPROVAL' && activeMission) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/mission/status/${activeMission.id}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();

            if (data.pilot_rejected) {
              clearInterval(interval);
              setApprovals({ pilot: false, manager: false });
              setMissionPhase('IDLE');
              alert('Mission REJECTED by the pilot via Telegram. Operation cancelled.');
              return;
            }

            setApprovals({ pilot: data.pilot_approved, manager: data.manager_approved });
            if (data.pilot_approved && data.manager_approved) {
              setMissionPhase('READY');
              clearInterval(interval);
            }
          }
        } catch (err) { console.error("Errore polling:", err); }
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [missionPhase, activeMission, token]);

  // Recupero missioni dal Backend
  const fetchMissions = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/missions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setServerMissions(data);
      }
    } catch (error) {
      console.error("Connection error to Python server:", error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMissions();
      const intervalId = setInterval(fetchMissions, 5000);
      return () => clearInterval(intervalId);
    }
  }, [token]);
  
  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen w-screen bg-neutral-900 text-white flex p-2 gap-2 font-sans overflow-hidden relative">
      
      {/* PANNELLO ADMIN */}
      {showAdminPanel && (
        <AdminPanel 
          token={token} 
          onClose={() => setShowAdminPanel(false)} 
          onMissionUploaded={fetchMissions} 
        />
      )}

      {/* MODALE DETTAGLI E AUTORIZZAZIONI */}
      {showDetailsModal && activeMission && (
        <MissionModal 
          activeMission={activeMission}
          onClose={() => setShowDetailsModal(false)}
          missionPhase={missionPhase}
          approvals={approvals}
          userRole={userRole}
          onRequestDispatch={handleRequestDispatch}
          onManagerApprove={handleManagerApprove}
          onUploadAndLaunch={handleUploadAndLaunch}
        />
      )}

      {/* PANNELLO CENTRALE (Mappa) */}
      <MapPanel
        activeMission={activeMission}
        mapCenter={mapCenter}
        token={token}
      />

      {/* SIDEBAR DESTRA */}
      <Sidebar 
        userRole={userRole}
        onOpenAdmin={() => setShowAdminPanel(true)}
        handleLogout={handleLogout}
        serverMissions={serverMissions}
        activeMission={activeMission}
        setActiveMission={(mission) => {
          // Quando si seleziona una missione dal DB, assicuriamoci di mantenere sia i waypoints per Leaflet che il payload MQTT
          setActiveMission(mission);
        }}
        setMissionPhase={setMissionPhase}
        setShowDetailsModal={setShowDetailsModal}
        emergencyProtocols={emergencyProtocols}
        onEmergencyAction={handleEmergencyAction}
      />
    </div>
  );
}