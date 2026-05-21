import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// 1. IMPORTIAMO LE EMERGENZE LOCALMENTE (Il Database non c'entra, sicurezza al 100%)
import emergenzaData from './data/ugcs/emergenza.json';
import Login from './Login';
import WeatherScreen from './WeatherScreen';
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
      
      {/* POP-UP MODAL */}
      {showDetailsModal && activeMission && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-800 border border-neutral-600 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all">
            <div className="bg-neutral-900 border-b border-neutral-700 p-4 flex justify-between items-center">
              <h2 className="text-yellow-400 font-bold text-lg flex items-center gap-2">
                📊 Scheda Tecnica Missione
              </h2>
              <button 
                onClick={() => setShowDetailsModal(false)} 
                className="text-neutral-400 hover:text-white font-bold text-xl px-2 rounded hover:bg-neutral-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
               <div className="bg-black/40 p-3 rounded border border-neutral-700">
                 <span className="text-xs text-neutral-500 block uppercase tracking-wider mb-1">Rotta Selezionata</span>
                 <strong className="text-white text-xl">{activeMission.name}</strong>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <div className="bg-black/40 p-3 rounded border border-neutral-700">
                   <span className="text-xs text-neutral-500 block uppercase tracking-wider mb-1">Altitudine Max</span>
                   <strong className="text-cyan-400 text-2xl">{activeMission.details?.max_altitude_m || "N/A"}<span className="text-sm text-neutral-400 ml-1">m</span></strong>
                 </div>
                 <div className="bg-black/40 p-3 rounded border border-neutral-700">
                   <span className="text-xs text-neutral-500 block uppercase tracking-wider mb-1">Punti Waypoint</span>
                   <strong className="text-cyan-400 text-2xl">{activeMission.details?.total_waypoints || 0}</strong>
                 </div>
               </div>

               <div className="bg-black/40 p-3 rounded border border-neutral-700">
                  <span className="text-xs text-neutral-500 block uppercase tracking-wider mb-1">Profilo di Volo Operativo</span>
                  <strong className="text-white text-lg">{activeMission.details?.flight_type || "Sconosciuto"}</strong>
               </div>

               <div className="bg-black/40 p-3 rounded border border-neutral-700">
                  <span className="text-xs text-neutral-500 block uppercase tracking-wider mb-1">Piattaforma di Pianificazione</span>
                  <strong className="text-white text-lg">{activeMission.details?.source_software || "N/A"}</strong>
               </div>
            </div>

            <div className="bg-neutral-900 border-t border-neutral-700 p-4 flex justify-end">
              <button 
                onClick={() => setShowDetailsModal(false)} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold transition shadow-lg"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEZIONE CENTRALE E SINISTRA */}
      <div className="flex flex-col flex-1 gap-2">
        <div className="flex-1 bg-black border border-neutral-700 rounded-lg flex items-center justify-center relative shadow-lg">
          <span className="text-neutral-500 font-bold text-xl">DIGITAL TWIN (Unreal Engine Stream)</span>
          <div className="absolute top-4 right-4 bg-black/70 p-3 rounded text-xs text-neutral-500 font-mono border border-neutral-700">
            <div>LAT: IN ATTESA...</div>
            <div>LON: IN ATTESA...</div>
            <div>ALT: N/A</div>
            <div>BAT: N/A</div>
          </div>
        </div>

        <div className="h-64 flex gap-2">
          <div className="w-1/3 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center">
            <span className="text-neutral-400">Telecamere Secondarie</span>
          </div>
          <div className="w-1/3 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center">
            <span className="text-neutral-400">Strumenti di Volo</span>
          </div>
          
          <div className="w-1/3 border border-neutral-700 rounded-lg overflow-hidden relative z-0">
            <div className="absolute top-0 left-0 bg-black/80 text-xs px-2 py-1 z-[1000] text-yellow-400 font-bold rounded-br-lg">
               Mappa / Piani di Volo
            </div>
            <MapContainer center={mapCenter} zoom={16} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              {activeMission && activeMission.waypoints && (
                <Polyline positions={activeMission.waypoints} color={activeMission.color || "cyan"} weight={4} dashArray="10, 10" />
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* SEZIONE DESTRA (Sidebar) */}
      <div className="w-96 flex flex-col gap-2">
        {/* HEADER UTENTE */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm">
            Ruolo: <span className="text-blue-400 uppercase font-bold">{userRole}</span>
          </span>
          <button onClick={handleLogout} className="bg-red-900/80 hover:bg-red-800 text-xs px-2 py-1 rounded transition border border-red-700">
            Disconnetti
          </button>
        </div>
        
        {/* LISTA MISSIONI (Database) */}
        <div className="h-[55%] bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex flex-col gap-2 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-neutral-600 pb-2 mb-2">
             <h2 className="text-yellow-400 font-bold">Missioni dal Database</h2>
             <button onClick={() => setActiveMission(null)} className="text-xs bg-neutral-700 hover:bg-neutral-600 px-2 py-1 rounded transition">Pulisci Mappa</button>
          </div>
          
          {serverMissions.length === 0 ? (
            <div className="text-neutral-500 text-sm italic text-center p-4">Nessuna missione trovata.</div>
          ) : (
            serverMissions.map((mission) => (
              <div 
                key={mission.mission_id}
                onClick={() => {
                  setActiveMission({
                    id: mission.mission_id,
                    name: mission.route,
                    color: "cyan",
                    waypoints: mission.waypoints,
                    details: mission.details 
                  });
                }}
                className={`p-3 rounded-lg text-sm cursor-pointer transition-all border ${activeMission?.id === mission.mission_id ? 'bg-blue-800/80 border-blue-400 shadow-lg' : 'bg-neutral-900/40 border-neutral-700 hover:border-neutral-500 hover:bg-neutral-700/50'}`}
              >
                <div className="font-bold flex justify-between">
                  <span className="text-base">{mission.route}</span>
                  <span className="text-[10px] uppercase font-bold bg-green-700 text-green-100 px-2 py-1 rounded-full flex items-center">{mission.status}</span>
                </div>
                <div className="text-xs text-neutral-400 mt-2">Piattaforma: <span className="text-white font-mono bg-neutral-800 px-1 rounded">{mission.drone}</span></div>
                
                {activeMission?.id === mission.mission_id && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetailsModal(true);
                    }}
                    className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 rounded text-xs transition shadow flex items-center justify-center gap-1"
                  >
                    📄 Apri Scheda Tecnica
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* COMANDI DI EMERGENZA (Sempre visibili e indipendenti dal DB) */}
        {userRole !== "spettatore" && (
        <div className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex flex-col overflow-y-auto">
          <h2 className="text-red-500 font-bold mb-3 border-b border-red-900/50 pb-2 flex items-center gap-2">
            🚨 Protocolli Failsafe
          </h2>
          
          <div className="flex flex-col gap-2">
            {emergencyProtocols.map((protocol) => (
              <button 
                key={protocol.id}
                onClick={() => {
                  if (protocol.type === "route") {
                    setActiveMission(protocol);
                  } else {
                    alert(`Comando inviato al drone: ${protocol.name}`);
                  }
                }} 
                className={`text-left font-bold py-3 px-3 rounded-lg w-full transition-all border shadow-sm ${
                  activeMission?.id === protocol.id 
                    ? 'bg-red-600 border-red-300 text-white ring-2 ring-red-400' 
                    : 'bg-red-900/40 hover:bg-red-800 border-red-900/50 text-red-100 hover:border-red-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{protocol.type === "route" ? "🗺️" : "⚡"}</span> 
                  <span className="text-sm">{protocol.id} - {protocol.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}