// src/components/MapPanel.jsx
import React from 'react';
import { MapContainer, TileLayer, Polyline, Polygon, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import DashboardPanel from './DashboardPanel';
import CesiumDigitalTwin from './CesiumDigitalTwin';
import { useTelemetry } from '../hooks/useTelemetry';
import { useNoFlyZones } from '../hooks/useNoFlyZones';

// 🔴 ICONA DRONE CUSTOM (Un radar blip rosso e visibile)
const droneIcon = new L.DivIcon({
  className: 'custom-drone-icon',
  html: '<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #ef4444;"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

export default function MapPanel({ activeMission, mapCenter, token }) {
  // No-Fly Zone e telemetria ora vengono da hook condivisi (vedi src/hooks):
  // niente più fetch/WebSocket duplicati tra MapPanel e DashboardPanel/AdminNFZManager.
  const { noFlyZones } = useNoFlyZones(token, { pollIntervalMs: 5000 });
  const liveDrones = useTelemetry();

  // 🚨 FILTRO ANTARTIDE: per la mappa/HUD ignoriamo i droni senza fix GPS reale (0,0)
  const activeDronesArray = Object.values(liveDrones).filter(
    (drone) => drone.position?.global?.latitude !== 0 && drone.position?.global?.longitude !== 0
  );
  // Prendiamo il primo drone connesso per alimentare l'HUD in alto
  const hudDrone = activeDronesArray.length > 0 ? activeDronesArray[0] : null;

  return (
    <div className="flex flex-col flex-1 gap-2">
      {/* SEZIONE SUPERIORE: DIGITAL TWIN / HUD OVERLAY */}
<div className="flex-1 bg-black border border-neutral-700 rounded-lg flex items-center justify-center relative shadow-lg overflow-hidden">

  {/* MOTORE 3D CESIUM */}
  <CesiumDigitalTwin telemetry={hudDrone} activeMission={activeMission} />

  {/* HUD OVERLAY (Rimane sopra il 3D grazie a absolute e z-index) */}
  <div className="absolute top-4 right-4 bg-black/70 p-3 rounded text-xs text-neutral-400 font-mono border border-neutral-700 min-w-[120px] z-10 pointer-events-none">
    <div className="font-bold text-cyan-400 mb-1 border-b border-neutral-700 pb-1">UAV TELEMETRY</div>
    <div>LAT: {hudDrone ? hudDrone.position.global.latitude.toFixed(6) : 'WAITING...'}</div>
    <div>LON: {hudDrone ? hudDrone.position.global.longitude.toFixed(6) : 'WAITING...'}</div>
    <div>ALT: {hudDrone ? `${hudDrone.position.global.altitude.toFixed(1)} m` : 'N/A'}</div>
    <div className={hudDrone && hudDrone.battery.percentage < 20 ? 'text-red-500 font-bold animate-pulse' : 'text-green-400'}>
      BAT: {hudDrone ? `${hudDrone.battery.percentage}%` : 'N/A'}
    </div>
  </div>
</div>

      {/* SEZIONE INFERIORE: DASHBOARD + MAPPA */}
      <div className="h-64 flex gap-2">
        <div className="w-2/3">
          <DashboardPanel token={token} />
        </div>
        
        {/* MAPPA 2D RADAR */}
        <div className="w-1/3 border border-neutral-700 rounded-lg overflow-hidden relative z-0">
          <div className="absolute top-0 left-0 bg-black/80 text-xs px-2 py-1 z-[1000] text-yellow-400 font-bold rounded-br-lg">
             Map / Active Radar
          </div>
          <MapContainer center={mapCenter} zoom={16} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            
            {/* RENDER NO-FLY ZONES */}
            {noFlyZones.map((nfz) => (
              <Polygon 
                key={nfz.id} 
                positions={nfz.coordinates} 
                pathOptions={{ 
                  color: '#ef4444',     
                  fillColor: '#ef4444', 
                  fillOpacity: 0.3,     
                  weight: 2 
                }} 
              />
            ))}

            {/* RENDER MISSIONE ATTIVA */}
            {activeMission && activeMission.waypoints && (
              <Polyline positions={activeMission.waypoints} color={activeMission.color || "cyan"} weight={4} dashArray="10, 10" />
            )}

            {/* 🔴 RENDER DRONI LIVE */}
            {activeDronesArray.map((drone) => (
              <Marker 
                key={drone.drone.id}
                position={[drone.position.global.latitude, drone.position.global.longitude]}
                icon={droneIcon}
              />
            ))}

          </MapContainer>
        </div>
      </div>
    </div>
  );
}