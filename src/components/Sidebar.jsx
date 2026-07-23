// src/components/Sidebar.jsx
import React from 'react';

export default function Sidebar({
  userRole,
  handleLogout,
  serverMissions,
  onOpenAdmin,
  activeMission,
  setActiveMission,
  setMissionPhase,
  setShowDetailsModal,
  emergencyProtocols,
  onEmergencyAction
}) {
  return (
    <div className="w-96 flex flex-col gap-2">
     {/* HEADER UTENTE */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 flex justify-between items-center">
        <span className="text-sm">
          Role: <span className="text-blue-400 uppercase font-bold">{userRole}</span>
        </span>
        <div className="flex gap-2">
          {userRole === 'responsabile' && (
            <button onClick={onOpenAdmin} className="bg-yellow-600/80 hover:bg-yellow-600 text-xs px-2 py-1 rounded transition border border-yellow-700">
              Admin
            </button>
          )}
          <button onClick={handleLogout} className="bg-red-900/80 hover:bg-red-800 text-xs px-2 py-1 rounded transition border border-red-700">
            Log Out
          </button>
        </div>
      </div>
      
      {/* LISTA MISSIONI */}
      <div className="h-[55%] bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex flex-col gap-2 overflow-y-auto">
        <div className="flex justify-between items-center border-b border-neutral-600 pb-2 mb-2">
           <h2 className="text-yellow-400 font-bold">Missions from Database</h2>
           <button onClick={() => { setActiveMission(null); setMissionPhase('IDLE'); }} className="text-xs bg-neutral-700 hover:bg-neutral-600 px-2 py-1 rounded transition">Clear Map</button>
        </div>

        {serverMissions.length === 0 ? (
          <div className="text-neutral-500 text-sm italic text-center p-4">No missions found.</div>
        ) : (
          serverMissions.map((mission) => {
            
            // Variabile di blocco ricevuta dal radar in tempo reale
            const isBlocked = mission.is_blocked;

            return (
            <div 
              key={mission.mission_id}
              onClick={() => {
                // SE È BLOCCATA DAL RADAR, FERMIAMO IL CLICK
                if (isBlocked) {
                  alert(`ACCESS DENIED: Mission "${mission.route}" intersects the active No-Fly Zone "${mission.blocked_by}".`);
                  return;
                }

                // Altrimenti, seleziona normalmente
                // Dentro Sidebar.jsx al click sulla missione:
                 setActiveMission({
                 id: mission.mission_id,
                 name: mission.route,
                 color: "cyan",
                 waypoints: mission.waypoints,
                 mqtt_payload: mission.mqtt_payload, // <-- IMPORTANTE: Passa il payload fornito dal backend Python!
                  details: mission.details 
                });
                setMissionPhase('IDLE');
              }}
              // Cambiamo lo stile se è bloccata (Diventa rossa)
              className={`p-3 rounded-lg text-sm transition-all border ${
                isBlocked ? 'bg-red-950/50 border-red-800 hover:border-red-500 cursor-not-allowed opacity-80' : 
                activeMission?.id === mission.mission_id ? 'bg-blue-800/80 border-blue-400 shadow-lg cursor-pointer' : 
                'bg-neutral-900/40 border-neutral-700 hover:border-neutral-500 hover:bg-neutral-700/50 cursor-pointer'
              }`}
            >
              <div className="font-bold flex justify-between items-center">
                <span className={`text-base ${isBlocked ? 'text-red-400 line-through' : 'text-white'}`}>
                  {mission.route}
                </span>
                
                {/* Badge Stato Dinamico */}
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full flex items-center ${
                  isBlocked ? 'bg-red-900 text-red-200 animate-pulse' : 
                  mission.status === 'PLANNED' ? 'bg-blue-700 text-blue-100' :
                  mission.status === 'ACTIVE' ? 'bg-green-700 text-green-100' :
                  'bg-neutral-700 text-neutral-100'
                }`}>
                  {isBlocked ? 'BLOCKED' : mission.status}
                </span>
              </div>

              <div className="text-xs text-neutral-400 mt-2 flex justify-between items-end">
                <span>Platform: <span className="text-white font-mono bg-neutral-800 px-1 rounded">{mission.drone}</span></span>
                {/* Se è bloccata, mostra chi è il colpevole */}
                {isBlocked && (
                  <span className="text-red-500 font-bold text-[10px]">
                    NFZ: {mission.blocked_by}
                  </span>
                )}
              </div>
              
             {activeMission?.id === mission.mission_id && !isBlocked && (
                <div className="mt-3 flex flex-col gap-2 border-t border-neutral-600 pt-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetailsModal(true);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 rounded text-xs transition shadow flex items-center justify-center gap-1"
                  >
                    Open Technical Sheet & Authorizations
                  </button>
                </div>
              )}
            </div>
          )})
        )}
      </div>

      {/* COMANDI DI EMERGENZA */}
      {userRole !== "spettatore" && (
      <div className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex flex-col overflow-y-auto">
        <h2 className="text-red-500 font-bold mb-3 border-b border-red-900/50 pb-2 flex items-center gap-2">
          Failsafe Protocols
        </h2>
        <div className="flex flex-col gap-2">
          {emergencyProtocols.map((protocol) => (
            <button 
              key={protocol.id}
              onClick={() => {
                if (protocol.type === "route") {
                  setActiveMission(protocol);
                } else {
                  onEmergencyAction(protocol);
                }
              }}
              className={`text-left font-bold py-3 px-3 rounded-lg w-full transition-all border shadow-sm ${
                activeMission?.id === protocol.id 
                  ? 'bg-red-600 border-red-300 text-white ring-2 ring-red-400' 
                  : 'bg-red-900/40 hover:bg-red-800 border-red-900/50 text-red-100 hover:border-red-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{protocol.id} - {protocol.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}