import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// IMPORT EMERGENCY ONLY (Failsafe locally stored)
import emergenzaData from './data/ugcs/emergenza.json';

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

const emergencyMission = {
  id: "E1", 
  name: "Emergenza perdita segnale", 
  color: "red",
  waypoints: extractUgcsWaypoints(emergenzaData)
};

export default function App() {
  const [activeMission, setActiveMission] = useState(null);
  const [serverMissions, setServerMissions] = useState([]);

  const mapCenter = [44.437475, 8.880381];

  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/missions');
        const data = await response.json();
        setServerMissions(data);
      } catch (error) {
        console.error("Connection error to Python server:", error);
      }
    };
    fetchMissions();
  }, []);

  return (
    <div className="h-screen w-screen bg-neutral-900 text-white flex p-2 gap-2 font-sans overflow-hidden">
      
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
              {activeMission && (
                <Polyline positions={activeMission.waypoints} color={activeMission.color} weight={4} dashArray="10, 10" />
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      <div className="w-96 flex flex-col gap-2">
        <div className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex flex-col gap-2 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-neutral-600 pb-1 mb-2">
             <h2 className="text-yellow-400 font-bold">Missioni dal Database</h2>
             <button onClick={() => setActiveMission(null)} className="text-xs bg-neutral-700 hover:bg-neutral-600 px-2 py-1 rounded">Pulisci Mappa</button>
          </div>
          
          {serverMissions.length === 0 ? (
            <div className="text-neutral-500 text-sm italic text-center p-4">Nessuna missione nel database. Lancia auto_importer.py</div>
          ) : (
            serverMissions.map((mission) => (
              <div 
                key={mission.mission_id}
                onClick={() => {
                  setActiveMission({
                    id: mission.mission_id,
                    name: mission.route,
                    color: "cyan", // Colore automatico per tutte le missioni del DB
                    waypoints: mission.waypoints // PRESO DIRETTAMENTE DAL SERVER!
                  });
                }}
                className={`p-3 rounded text-sm cursor-pointer transition border ${activeMission?.id === mission.mission_id ? 'bg-blue-800 border-blue-400' : 'bg-blue-900/40 border-transparent hover:bg-blue-800/60'}`}
              >
                <div className="font-bold flex justify-between">
                  <span>{mission.route}</span>
                  <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{mission.status}</span>
                </div>
                <div className="text-xs text-neutral-400 mt-1">Drone: <span className="text-white">{mission.drone}</span></div>
              </div>
            ))
          )}
        </div>

        <div className="h-28 bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <h2 className="text-yellow-400 font-bold mb-2 border-b border-neutral-600 pb-1">Dettagli Missione</h2>
          {activeMission ? (
             <div className="bg-neutral-900/50 border border-neutral-600 p-2 rounded text-sm text-neutral-300">
               Anteprima caricata: <strong className="text-white block truncate">{activeMission.name}</strong>
             </div>
          ) : (
             <div className="text-neutral-500 text-sm italic">Seleziona una missione per visualizzarla.</div>
          )}
        </div>

        <div className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex flex-col">
          <h2 className="text-yellow-400 font-bold mb-2 border-b border-neutral-600 pb-1">Comandi Assistenza</h2>
          
          <button 
            onClick={() => setActiveMission(emergencyMission)} 
            className={`font-bold py-3 px-4 rounded mb-2 w-full text-left transition-colors shadow-md border ${
              activeMission?.id === emergencyMission.id 
                ? 'bg-red-600 border-red-300 text-white ring-2 ring-red-400' 
                : 'bg-red-800 hover:bg-red-700 border-red-900 text-white'
            }`}
          >
            🚨 {emergencyMission.id} - {emergencyMission.name}
          </button>

          <button className="bg-neutral-700/50 cursor-not-allowed text-white/50 font-bold py-2 px-4 rounded mb-2 w-full text-left mt-2">
            A1 - Return to Home
          </button>
        </div>
      </div>

    </div>
  );
}