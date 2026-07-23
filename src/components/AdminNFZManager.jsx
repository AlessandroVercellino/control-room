// src/components/AdminNFZManager.jsx
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { API_BASE_URL } from '../config';
import { useNoFlyZones } from '../hooks/useNoFlyZones';

// Componente interno per i controlli di disegno (attivo SOLO qui nell'Admin)
const ControlliDisegnoAdmin = ({ onZonaCreata, token }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawCircle: false,
      drawRectangle: true,
      drawPolygon: true,
      editMode: true,
      removalMode: true,
    });

    map.on('pm:create', async (e) => {
      const layer = e.layer;
      const geojson = layer.toGeoJSON();
      const rawCoordinates = geojson.geometry.coordinates[0];
      
      const nomeZona = prompt("NEW NO-FLY ZONE NAME:");
      if (!nomeZona) {
        layer.remove();
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/nfz/draw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: nomeZona,
            description: "Creata da Admin Panel",
            coordinates: rawCoordinates
          }),
        });

        if (response.ok) {
          layer.remove(); // Rimuove il disegno temporaneo, verrà rimpiazzato dal poligono ufficiale del DB
          if (onZonaCreata) onZonaCreata();
        } else {
          alert("Error while saving.");
          layer.remove();
        }
      } catch (error) {
        console.error("Errore:", error);
        layer.remove();
      }
    });

    return () => {
      map.pm.removeControls();
      map.off('pm:create');
    };
  }, [map, onZonaCreata, token]);

  return null;
};

export default function AdminNFZManager({ token }) {
  const centroDefault = [44.5714, 8.9482]; // Centrato sull'area operativa
  // Stessa fonte dati usata da MapPanel (src/hooks/useNoFlyZones.js), niente fetch duplicata
  const { noFlyZones, refetchNFZ } = useNoFlyZones(token);

  const eliminaZona = async (id, nome) => {
    if (!window.confirm(`Deactivate the No-Fly Zone "${nome}"?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/nfz/${id}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) refetchNFZ();
    } catch (error) {
      console.error("Errore eliminazione:", error);
    }
  };

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-700 rounded-lg text-white flex flex-col gap-4">
      <h2 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
        Geofencing Configuration Panel (No-Fly Zones)
      </h2>
      <p className="text-xs text-neutral-400">
        Use the map tools to draw a new restriction polygon, or remove existing zones from the table below.
      </p>

      <div className="flex flex-col lg:flex-row gap-4 h-[450px]">
        {/* MAPPA DI EDITING */}
        <div className="w-full lg:w-1/2 rounded-lg overflow-hidden border border-neutral-700 h-full relative z-0">
          <MapContainer center={centroDefault} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            <ControlliDisegnoAdmin onZonaCreata={refetchNFZ} token={token} />
            
            {noFlyZones.map((nfz) => (
              <Polygon 
                key={nfz.id} 
                positions={nfz.coordinates} 
                pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 2 }} 
              />
            ))}
          </MapContainer>
        </div>

        {/* TABELLA DI RIMOZIONE */}
        <div className="w-full lg:w-1/2 border border-neutral-700 rounded-lg bg-neutral-950 p-3 overflow-y-auto h-full">
          <h3 className="text-sm font-semibold text-neutral-300 mb-2 border-b border-neutral-800 pb-1">Active Zones in Database</h3>
          {noFlyZones.length === 0 ? (
            <div className="text-xs italic text-neutral-500 p-2">No active restrictions on the radar.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900 text-neutral-400 sticky top-0">
                <tr>
                  <th className="p-2">ID</th>
                  <th className="p-2">Name</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {noFlyZones.map((z) => (
                  <tr key={z.id} className="border-b border-neutral-900 hover:bg-neutral-900/40">
                    <td className="p-2 text-neutral-500">#{z.id}</td>
                    <td className="p-2 font-mono text-red-400">{z.name}</td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => eliminaZona(z.id, z.name)}
                        className="bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white px-2 py-1 rounded transition-colors text-[11px]"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}