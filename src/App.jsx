import React, { useState } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// 1. IMPORT DEI TUOI FILE UGCS
import emergenzaData from './data/ugcs/emergenza.json';
import fotoTettiData from './data/ugcs/foto_tetti.json';
import rilevamentoData from './data/ugcs/rilevamento.json';

// 2. FUNZIONE PER ESTRARRE LE COORDINATE (Radianti -> Gradi)
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
  try { searchPoints(ugcsJson); } catch (e) { console.error("Errore:", e); }
  return points;
}

// 3. SEPARIAMO LE MISSIONI DI ROUTINE DALLA MISSIONE DI EMERGENZA
const standardMissions = {
  missione2: {
    id: "M2", nome: "Fotografie Tetti", colore: "lime",
    waypoints: extractUgcsWaypoints(fotoTettiData)
  },
  missione3: {
    id: "M3", nome: "Rilevamento VOC Matrice", colore: "cyan",
    waypoints: extractUgcsWaypoints(rilevamentoData)
  }
};

const emergencyMission = {
  id: "E1", nome: "Emergenza perdita segnale", colore: "red",
  waypoints: extractUgcsWaypoints(emergenzaData)
};

function App() {
  const [activeMission, setActiveMission] = useState(null);
  const mapCenter = [44.437475, 8.880381];

  return (
    <div className="h-screen w-screen bg-neutral-900 text-white flex p-2 gap-2 font-sans overflow-hidden">
      
      {/* SEZIONE SINISTRA E CENTRALE */}
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
              <TileLayer 
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
                 
              />
              {activeMission && (
                <Polyline positions={activeMission.waypoints} color={activeMission.colore} weight={4} dashArray="10, 10" />
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* SEZIONE DESTRA (Sidebar Gestione) */}
      <div className="w-96 flex flex-col gap-2">
        
        {/* MISSIONI STANDARD */}
        <div className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex flex-col gap-2 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-neutral-600 pb-1 mb-2">
             <h2 className="text-yellow-400 font-bold">Piani di Volo (Routine)</h2>
             <button onClick={() => setActiveMission(null)} className="text-xs bg-neutral-700 hover:bg-neutral-600 px-2 py-1 rounded">Pulisci Mappa</button>
          </div>
          {Object.entries(standardMissions).map(([key, mission]) => (
            <div key={key} onClick={() => setActiveMission(mission)} className={`p-3 rounded text-sm cursor-pointer transition border ${activeMission?.id === mission.id ? 'bg-blue-800 border-blue-400' : 'bg-blue-900/40 border-transparent hover:bg-blue-800/60'}`}>
              <div className="font-bold">{mission.nome}</div>
              <div className="text-xs text-neutral-400 mt-1">Waypoint estratti: {mission.waypoints.length}</div>
            </div>
          ))}
        </div>

        {/* DETTAGLI MISSIONE (In mezzo) */}
        <div className="h-28 bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <h2 className="text-yellow-400 font-bold mb-2 border-b border-neutral-600 pb-1">Dettagli Missione</h2>
          {activeMission ? (
             <div className="bg-neutral-900/50 border border-neutral-600 p-2 rounded text-sm text-neutral-300">
               Anteprima caricata: <strong className="text-white block truncate">{activeMission.nome}</strong>
             </div>
          ) : (
             <div className="text-neutral-500 text-sm italic">Seleziona una missione.</div>
          )}
        </div>

        {/* COMANDI ASSISTENZA ED EMERGENZA (In basso) */}
        <div className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex flex-col">
          <h2 className="text-yellow-400 font-bold mb-2 border-b border-neutral-600 pb-1">Comandi Assistenza</h2>
          
          {/* NUOVO TASTO EMERGENZA DINAMICO */}
          <button 
            onClick={() => setActiveMission(emergencyMission)} 
            className={`font-bold py-3 px-4 rounded mb-2 w-full text-left transition-colors shadow-md border ${
              activeMission?.id === emergencyMission.id 
                ? 'bg-red-600 border-red-300 text-white ring-2 ring-red-400' 
                : 'bg-red-800 hover:bg-red-700 border-red-900 text-white'
            }`}
          >
            🚨 {emergencyMission.id} - {emergencyMission.nome}
          </button>

          <button className="bg-neutral-700/50 cursor-not-allowed text-white/50 font-bold py-2 px-4 rounded mb-2 w-full text-left mt-2">
            A1 - Return to Home
          </button>
          <button className="bg-neutral-700/50 cursor-not-allowed text-white/50 font-bold py-2 px-4 rounded mb-2 w-full text-left">
            E6 - Atterraggio Immediato
          </button>
        </div>
      </div>

    </div>
  );
}

export default App;