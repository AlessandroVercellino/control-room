import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// 1. IMPORTIAMO LE EMERGENZE LOCALMENTE (Il Database non c'entra, sicurezza al 100%)
import emergenzaData from './data/ugcs/emergenza.json';
import Login from './Login';
import WeatherScreen from './WeatherScreen';
import MissionModal from './components/MissionModal';
import MapPanel from './components/MapPanel';
import Sidebar from './components/Sidebar';
import AdminPanel from './components/AdminPanel';
//import RTH from './data/ugcs/rth.json';

function extractUgcsWaypoints(ugcsJson) {
  let points = [];
  function searchPoints(obj) {
    if (!obj) return;
    if (typeof obj.latitude === 'number' && typeof obj.longitude === 'number') {
      points.push([obj.latitude * (180 / Math.PI), obj.longitude * (180 / Math.PI)]);
    } else if (Array.isArray(obj)) {
      obj.forEach(item => searchPoints(item));
    } else if (typeof obj === 'object') {
      Object.values(obj).forEach(val => searchPoints(val));
    }
  }
  try { searchPoints(ugcsJson); } catch (e) { console.error("Error:", e); }
  return points;
}

// 2. LA NOSTRA LISTA DEI PROTOCOLLI DI EMERGENZA (Sempre disponibili)
const emergencyProtocols = [
  {
    id: "E1", 
    name: "Rotta Failsafe (Perdita Segnale)", 
    type: "route",
    color: "red",
    waypoints: extractUgcsWaypoints(emergenzaData),
    details: {
      max_altitude_m: 120.0,
      total_waypoints: extractUgcsWaypoints(emergenzaData).length,
      source_software: "Failsafe System Local",
      flight_type: "Emergency Pre-Planned Route"
    }
  },
  {
    id: "E2",
    name: "Return to Home Diretto (RTH)",
    type: "action"
  },
  
];

export default function App() {

 // 🔒 CONTROLLO MULTI-SCHERMO PROTETTO
  if (window.location.pathname === '/meteo' || window.location.hash === '#/meteo') {
    const savedToken = localStorage.getItem('control_room_token');
    
    // Se non c'è il token nel localStorage, l'accesso viene negato istantaneamente
    if (!savedToken) {
      return (
        <div className="h-screen w-screen bg-black text-red-500 flex flex-col items-center justify-center font-mono p-4 border-4 border-red-900">
          <div className="text-3xl font-black tracking-widest animate-pulse">⚠️ SECURITY VIOLATION</div>
          <div className="text-sm text-neutral-500 mt-2 uppercase tracking-wider">Accesso negato. Inizializzare la connessione dalla Control Room principale.</div>
        </div>
      );
    }
    return <WeatherScreen />;
  }

  const [activeMission, setActiveMission] = useState(null);
  const [serverMissions, setServerMissions] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const mapCenter = [44.437475, 8.880381];
  const [token, setToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
const handleLoginSuccess = (jwtToken, role) => {
    setToken(jwtToken);
    setUserRole(role);
    // Salva le credenziali nel browser per gli altri schermi
    localStorage.setItem('control_room_token', jwtToken);
    localStorage.setItem('control_room_role', role);
  };

  const handleLogout = () => {
    setToken(null);
    setUserRole(null);
    // Pulisce il browser alla disconnessione
    localStorage.removeItem('control_room_token');
    localStorage.removeItem('control_room_role');
  };

  // --- INIZIO LOGICA TELEGRAM WORKFLOW ---
  const [missionPhase, setMissionPhase] = useState('IDLE'); // IDLE, AWAITING_APPROVAL, READY
  const [approvals, setApprovals] = useState({ pilot: false, manager: false });

  const handleRequestDispatch = async (e) => {
    e.stopPropagation(); // Evita di ricaricare la mappa quando clicchi il bottone
    setMissionPhase('AWAITING_APPROVAL');
    setApprovals({ pilot: false, manager: false });
    try {
      await fetch("http://127.0.0.1:8000/api/mission/request-clearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission_id: activeMission.id, mission_name: activeMission.name })
      });
    } catch (err) { console.error("Errore Telegram:", err); }
  };

  const handleManagerApprove = async (e) => {
    e.stopPropagation();
    try {
      await fetch(`http://127.0.0.1:8000/api/mission/approve-manager/${activeMission.id}`, { method: "POST" });
      setApprovals(prev => ({ ...prev, manager: true }));
    } catch (err) { console.error(err); }
  };

  const handleUploadAndLaunch = (e) => {
    e.stopPropagation();
    alert("🚀 PIANO DI VOLO CARICATO SUL DRONE! Inizio sequenza di armamento...");
    setMissionPhase('IDLE'); // Resetta l'interfaccia
  };

  // Polling: Controlla ogni secondo se hai cliccato sul telefono
  useEffect(() => {
    let interval = null;
    if (missionPhase === 'AWAITING_APPROVAL' && activeMission) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`http://127.0.0.1:8000/api/mission/status/${activeMission.id}`);
          if (response.ok) {
            const data = await response.json();
            setApprovals({ pilot: data.pilot_approved, manager: data.manager_approved });
            // Se entrambi i semafori sono verdi, sblocca il lancio
            if (data.pilot_approved && data.manager_approved) {
              setMissionPhase('READY');
              clearInterval(interval);
            }
          }
        } catch (err) { console.error("Errore polling:", err); }
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [missionPhase, activeMission]);
  // --- FINE LOGICA TELEGRAM WORKFLOW ---

  useEffect(() => {
    // 1. Definiamo la funzione asincrona internamente
    const fetchMissions = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/missions', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        setServerMissions(data);
      } catch (error) {
        console.error("Connection error to Python server:", error);
      }
    };

    // 2. Eseguiamo la funzione SOLO se c'è un token valido
    if (token) {
      fetchMissions();
    }
    
  // 3. Il token va qui, nelle parentesi quadre finali
  }, [token]);
  
  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }
  return (
    <div className="h-screen w-screen bg-neutral-900 text-white flex p-2 gap-2 font-sans overflow-hidden relative">
      
      {/* IL PANNELLO ADMIN (Si sovrappone a tutto se lo stato è true) */}
      {showAdminPanel && (
        <AdminPanel token={token} onClose={() => setShowAdminPanel(false)} />
      )}

      {/* POP-UP MODAL */}
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

      {/* SEZIONE CENTRALE E SINISTRA */}
      <MapPanel 
        activeMission={activeMission} 
        mapCenter={mapCenter} 
      />

      {/* SEZIONE DESTRA (Sidebar) */}
    <Sidebar 
        userRole={userRole}
        onOpenAdmin={() => setShowAdminPanel(true)}
        handleLogout={handleLogout}
        serverMissions={serverMissions}
        activeMission={activeMission}
        setActiveMission={setActiveMission}
        setMissionPhase={setMissionPhase}
        setShowDetailsModal={setShowDetailsModal}
        emergencyProtocols={emergencyProtocols}
      />
    </div>
  );
}