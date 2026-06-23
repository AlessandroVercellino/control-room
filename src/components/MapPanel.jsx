// src/components/MapPanel.jsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import DashboardPanel from './DashboardPanel';

export default function MapPanel({ activeMission, mapCenter }) {
  const [noFlyZones, setNoFlyZones] = useState([]);

  useEffect(() => {
    // Funzione che interroga il server
    const fetchNFZ = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/nfz');
        if (response.ok) {
          const data = await response.json();
          setNoFlyZones(data);
        }
      } catch (error) {
        console.error("Errore nel caricamento delle No-Fly Zone dal radar:", error);
      }
    };

    // 1. Chiamata immediata appena il componente viene caricato
    fetchNFZ();
    
    // 2. Facciamo partire il timer: aggiorna la mappa ogni 5 secondi (5000 ms)
    const intervalId = setInterval(fetchNFZ, 5000);

    // 3. CLEANUP: Spegniamo il timer se l'utente cambia pagina (fondamentale per non intaserare la RAM)
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col flex-1 gap-2">
      
      {/* SEZIONE SUPERIORE: DIGITAL TWIN */}
      <div className="flex-1 bg-black border border-neutral-700 rounded-lg flex items-center justify-center relative shadow-lg">
        <span className="text-neutral-500 font-bold text-xl">DIGITAL TWIN (Unreal Engine Stream)</span>
        <div className="absolute top-4 right-4 bg-black/70 p-3 rounded text-xs text-neutral-500 font-mono border border-neutral-700">
          <div>LAT: IN ATTESA...</div>
          <div>LON: IN ATTESA...</div>
          <div>ALT: N/A</div>
          <div>BAT: N/A</div>
        </div>
      </div>

      {/* SEZIONE INFERIORE: DASHBOARD + MAPPA */}
      <div className="h-64 flex gap-2">
        
        {/* DASHBOARD MULTI-TAB */}
        <div className="w-2/3">
          <DashboardPanel />
        </div>
        
        {/* MAPPA */}
        <div className="w-1/3 border border-neutral-700 rounded-lg overflow-hidden relative z-0">
          <div className="absolute top-0 left-0 bg-black/80 text-xs px-2 py-1 z-[1000] text-yellow-400 font-bold rounded-br-lg">
             Mappa / Piani di Volo
          </div>
          <MapContainer center={mapCenter} zoom={16} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            
            {/* 🛑 RENDER DELLE NO-FLY ZONES IN ROSSO TRASPARENTE */}
            {noFlyZones.map((nfz) => (
              <Polygon 
                key={nfz.id} 
                positions={nfz.coordinates} 
                pathOptions={{ 
                  color: '#ef4444',     // Bordo rosso
                  fillColor: '#ef4444', // Interno rosso
                  fillOpacity: 0.3,     // Trasparenza
                  weight: 2 
                }} 
              />
            ))}

            {/* RENDER DELLA MISSIONE SELEZIONATA (SOPRA LE NFZ) */}
            {activeMission && activeMission.waypoints && (
              <Polyline positions={activeMission.waypoints} color={activeMission.color || "cyan"} weight={4} dashArray="10, 10" />
            )}
            
          </MapContainer>
        </div>

      </div>
    </div>
  );
}