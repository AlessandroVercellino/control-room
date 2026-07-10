import React, { useState, useEffect } from 'react';

const TABS = [
  { id: 'Droni', label: 'Droni', dotColor: 'bg-yellow-500' },
  { id: 'Payload', label: 'Payload', dotColor: 'bg-cyan-500' },
  { id: 'Meteo', label: 'Meteo', dotColor: 'bg-green-500' },
  { id: 'Sicurezza', label: 'Sicurezza', dotColor: 'bg-red-500', isAlert: true },
  { id: 'Reti', label: 'Reti', dotColor: 'bg-orange-500' },
  { id: 'Piloti', label: 'Piloti', dotColor: 'bg-blue-500' },
  { id: 'RID', label: 'RID', dotColor: 'bg-fuchsia-500' },
  { id: 'Impostazioni', label: 'Impostazioni', dotColor: 'bg-lime-500' }
];

export default function DashboardPanel() {
  const [activeTab, setActiveTab] = useState('Droni');
  const [liveDrones, setLiveDrones] = useState({});

  // 🔌 CONNESSIONE WEBSOCKET PER TELEMETRIA REALE
  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:8000/ws/telemetry');
    
    ws.onopen = () => console.log("🟢 Connesso al WebSocket della Telemetria!");
    
    ws.onmessage = (event) => {
      try {
        const telemetria = JSON.parse(event.data);
        console.log("🚁 DATI REALI DAL DRONE:", telemetria);
        const droneId = telemetria.drone.id;
        setLiveDrones(prevDrones => ({
          ...prevDrones,
          [droneId]: telemetria
        }));
      } catch (error) {
        console.error("Errore di lettura dati telemetria:", error);
      }
    };

    ws.onclose = () => console.log("🔴 Connessione WebSocket persa.");
    return () => ws.close();
  }, []);

  const getFlightStatus = (statusId) => {
    if (statusId === 0) return { text: "A TERRA", style: "bg-neutral-500/20 text-neutral-400" };
    if (statusId === 1) return { text: "ARMATO", style: "bg-yellow-500/20 text-yellow-400 animate-pulse" };
    if (statusId === 2) return { text: "IN VOLO", style: "bg-green-500/20 text-green-400 font-bold" };
    return { text: "SCONOSCIUTO", style: "bg-red-500/20 text-red-400" };
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Droni':
        const activeDronesArray = Object.values(liveDrones);
        return (
          <div className="overflow-x-auto">
            {activeDronesArray.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 font-mono animate-pulse">
                IN ATTESA DI CONNESSIONE TELEMETRICA DAL DRONE...
              </div>
            ) : (
              <table className="w-full text-left text-sm text-white">
                <thead className="text-xs uppercase text-neutral-400 border-b border-neutral-700">
                  <tr>
                    <th className="px-4 py-2">ID</th>
                    <th className="px-4 py-2">Model</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Altitude (AGL/ASL)</th>
                    <th className="px-4 py-2">Vertical Speed</th>
                    <th className="px-4 py-2">Ground Speed</th>
                    <th className="px-4 py-2">Battery</th>
                    <th className="px-4 py-2">GPS Sats</th>
                    <th className="px-4 py-2">Avoidance</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDronesArray.map((droneData) => {
                    const statusInfo = getFlightStatus(droneData.status.inFlight);
                    const groundSpeed = Math.sqrt(Math.pow(droneData.velocity.linear.x, 2) + Math.pow(droneData.velocity.linear.y, 2)).toFixed(1);
                    
                    return (
                      <tr key={droneData.drone.id} className="border-b border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 transition">
                        <td className="px-4 py-2 font-bold bg-yellow-400 text-black w-24">DRONE {droneData.drone.id}</td>
                        <td className="px-4 py-2">{droneData.drone.type}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-xs ${statusInfo.style}`}>
                            {statusInfo.text}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">
                          <div className="text-cyan-400 font-bold">
                            {droneData.position?.relative?.height !== undefined 
                              ? `${droneData.position.relative.height.toFixed(1)} m AGL` 
                              : 'N/A AGL'}
                          </div>
                          <div className="text-neutral-500">
                            {droneData.position?.global?.altitude !== undefined 
                              ? `${droneData.position.global.altitude.toFixed(1)} m ASL` 
                              : 'N/A ASL'}
                          </div>
                        </td>
                        <td className="px-4 py-2 font-mono">{droneData.velocity.linear.z.toFixed(1)} m/s</td>
                        <td className="px-4 py-2 font-mono">{groundSpeed} m/s</td>
                        <td className="px-4 py-2">
                          <span className={`font-bold ${droneData.battery.percentage < 20 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                            {droneData.battery.percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-2">{droneData.gps.satelliteNumber} Sats</td>
                        <td className="px-4 py-2">
                          {droneData.avoidance.distance.front < 3 ? (
                            <span className="text-red-500 font-bold animate-ping">ALARM</span>
                          ) : (
                            <span className="text-green-500">CLEAR</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      default:
        return <div className="p-4 text-neutral-400">Contenuto in fase di sviluppo.</div>;
    }
  };

  return (
    <div className="h-full w-full bg-[#1e1e1e] border border-neutral-700 rounded-lg flex flex-col">
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-neutral-800 bg-[#141414] rounded-t-lg">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${activeTab === tab.id ? 'bg-neutral-700 text-white shadow-inner' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'} ${tab.isAlert ? 'border border-red-500 animate-pulse' : ''}`}
          >
            <span className={`w-3 h-3 rounded-full ${tab.dotColor}`}></span>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2">{renderContent()}</div>
    </div>
  );
}