import React, { useState } from 'react';

// Definizione dei Tab con i rispettivi colori (presi dal tuo mockup)
const TABS = [
  { id: 'Droni', label: 'Droni', dotColor: 'bg-yellow-500' },
  { id: 'Payload', label: 'Payload', dotColor: 'bg-cyan-500' },
  { id: 'Meteo', label: 'Meteo', dotColor: 'bg-green-500' },
  { id: 'Sicurezza', label: 'Sicurezza', dotColor: 'bg-red-500', isAlert: true }, // isAlert a true lo fa lampeggiare!
  { id: 'Reti', label: 'Reti', dotColor: 'bg-orange-500' },
  { id: 'Piloti', label: 'Piloti', dotColor: 'bg-blue-500' },
  { id: 'RID', label: 'RID', dotColor: 'bg-fuchsia-500' },
  { id: 'Impostazioni', label: 'Impostazioni', dotColor: 'bg-lime-500' }
];

export default function DashboardPanel() {
  const [activeTab, setActiveTab] = useState('Droni');

  // RENDERIZZAZIONE CONDIZIONALE DEI CONTENUTI
  const renderContent = () => {
    switch (activeTab) {
      case 'Droni':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-white">
              <thead className="text-xs uppercase text-neutral-400 border-b border-neutral-700">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Model</th>
                  <th className="px-4 py-2">Payload</th>
                  <th className="px-4 py-2">Mode</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Altitude AGL</th>
                  <th className="px-4 py-2">Vertical Speed</th>
                  <th className="px-4 py-2">Ground Speed</th>
                  <th className="px-4 py-2">Separation</th>
                  <th className="px-4 py-2">Battery</th>
                  <th className="px-4 py-2">GPS Fix</th>
                  <th className="px-4 py-2">Datalink</th>
                </tr>
              </thead>
              <tbody>
                {/* DRONE 1 */}
                <tr className="border-b border-neutral-800 bg-neutral-900/50">
                  <td className="px-4 py-2 font-bold bg-yellow-400 text-black">DRONE 1</td>
                  <td className="px-4 py-2">MATRICE 350 RTK</td>
                  <td className="px-4 py-2">VOC SENSOR</td>
                  <td className="px-4 py-2 bg-green-500/20 text-green-400 font-bold">ARMED</td>
                  <td className="px-4 py-2 bg-green-500/20 text-green-400 font-bold">FLIGHT</td>
                  <td className="px-4 py-2">36.4</td>
                  <td className="px-4 py-2 text-green-400">0.2</td>
                  <td className="px-4 py-2">1.2</td>
                  <td className="px-4 py-2">212</td>
                  <td className="px-4 py-2">66%</td>
                  <td className="px-4 py-2">3D FIX</td>
                  <td className="px-4 py-2">85%</td>
                </tr>
                {/* DRONE 2 */}
                <tr className="border-b border-neutral-800 bg-neutral-900/50">
                  <td className="px-4 py-2 font-bold bg-cyan-500 text-black">DRONE 2</td>
                  <td className="px-4 py-2">MAVIC 3E RTK</td>
                  <td className="px-4 py-2 text-neutral-500">N/A</td>
                  <td className="px-4 py-2 bg-green-500/20 text-green-400 font-bold">ARMED</td>
                  <td className="px-4 py-2 bg-green-500/20 text-green-400 font-bold">FLIGHT</td>
                  <td className="px-4 py-2">52.8</td>
                  <td className="px-4 py-2 text-red-400">-0.1</td>
                  <td className="px-4 py-2">0.5</td>
                  <td className="px-4 py-2">188</td>
                  <td className="px-4 py-2">80%</td>
                  <td className="px-4 py-2">3D FIX</td>
                  <td className="px-4 py-2">99%</td>
                </tr>
                {/* UNAUTHORIZED DRONE */}
                <tr className="bg-red-600 font-bold">
                  <td className="px-4 py-2">UNAUTHORIZED 1</td>
                  <td className="px-4 py-2">MINI 4 PRO</td>
                  <td className="px-4 py-2">UNKNOWN</td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2">FLIGHT</td>
                  <td className="px-4 py-2">65.2</td>
                  <td className="px-4 py-2">0.0</td>
                  <td className="px-4 py-2">12.6</td>
                  <td className="px-4 py-2">188</td>
                  <td className="px-4 py-2 text-neutral-300">N/A</td>
                  <td className="px-4 py-2 text-neutral-300">N/A</td>
                  <td className="px-4 py-2 text-neutral-300">N/A</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      case 'Payload':
        return <div className="p-4 text-neutral-400">📊 Flusso dati payload (Termocamere, Sniffer VOC) in attesa di connessione...</div>;
      case 'Meteo':
        return <div className="p-4 text-neutral-400">🌤️ Dati stazioni meteo: Vento 12 nodi da N/NE - Umidità 65%</div>;
      case 'Reti':
        return <div className="p-4 text-neutral-400">📡 Connessione MQTT attiva. Latenza: 24ms</div>;
      case 'Piloti':
        return <div className="p-4 text-neutral-400">👨‍✈️ Piloti operativi: Alessandro (Badge: admin123)</div>;
      default:
        return <div className="p-4 text-neutral-400">Contenuto in fase di sviluppo.</div>;
    }
  };

  return (
    <div className="h-full w-full bg-[#1e1e1e] border border-neutral-700 rounded-lg flex flex-col">
      
      {/* BARRA SUPERIORE (BOTTONI/TAB) */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-neutral-800 bg-[#141414] rounded-t-lg">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all duration-200
                ${isActive ? 'bg-neutral-700 text-white shadow-inner' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'}
                ${tab.isAlert ? 'border border-red-500 animate-pulse' : 'border border-transparent'}
              `}
            >
              {/* Pallino colorato */}
              <span className={`w-3 h-3 rounded-full ${tab.dotColor} ${tab.isAlert ? 'animate-ping' : ''}`}></span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* AREA CONTENUTO INFERIORE */}
      <div className="flex-1 overflow-y-auto p-2">
        {renderContent()}
      </div>

    </div>
  );
}