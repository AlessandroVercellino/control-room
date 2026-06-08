// src/components/MissionModal.jsx
import React from 'react';

export default function MissionModal({
  activeMission,
  onClose,
  missionPhase,
  approvals,
  userRole,
  onRequestDispatch,
  onManagerApprove,
  onUploadAndLaunch
}) {
  if (!activeMission) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-neutral-800 border border-neutral-600 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all">
        <div className="bg-neutral-900 border-b border-neutral-700 p-4 flex justify-between items-center">
          <h2 className="text-yellow-400 font-bold text-lg flex items-center gap-2">
            📊 Scheda Tecnica Missione
          </h2>
          <button 
            onClick={onClose} 
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
            onClick={onClose} 
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold transition shadow-lg mb-2 mr-2"
          >
            Chiudi
          </button>
        </div>
        
        {/* I BOTTONI DI TELEGRAM (Ricevono le funzioni dal padre App.jsx) */}
        <div className="px-6 pb-6">
          {missionPhase === 'IDLE' && (
            <button
              onClick={onRequestDispatch}
              className="w-full bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-2 rounded text-xs transition shadow uppercase tracking-wider"
            >
              1. Richiedi Clearance
            </button>
          )}

          {missionPhase === 'AWAITING_APPROVAL' && (
            <div className="bg-black/60 p-2 rounded border border-neutral-600 text-xs mt-1">
              <div className="text-neutral-400 mb-2 tracking-widest uppercase text-[10px]">Stato Autorizzazioni:</div>
              <div className="flex justify-between items-center mb-1">
                <span>Pilota (Telegram):</span>
                <span className={approvals.pilot ? "text-green-500 font-bold" : "text-yellow-500 animate-pulse"}>
                  {approvals.pilot ? "✔ OK" : "ATTESA..."}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Resp. Sala:</span>
                {userRole === 'responsabile' && !approvals.manager ? (
                  <button onClick={onManagerApprove} className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded text-[10px]">Approva</button>
                ) : (
                  <span className={approvals.manager ? "text-green-500 font-bold" : "text-yellow-500 animate-pulse"}>
                    {approvals.manager ? "✔ OK" : "ATTESA..."}
                  </span>
                )}
              </div>
            </div>
          )}

          {missionPhase === 'READY' && (
            <button
              onClick={onUploadAndLaunch}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded text-xs transition shadow uppercase tracking-wider animate-pulse mt-1"
            >
              🚀 UPLOAD TO DRONE & ARM
            </button>
          )}
        </div>

      </div>
    </div>
  );
}