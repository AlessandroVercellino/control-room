import React, { useEffect, useState } from 'react';
import { useTelemetry, useTelemetryStatus } from '../hooks/useTelemetry';
import { API_BASE_URL } from '../config';

const TABS = [
  { id: 'Drones', label: 'Drones', dotColor: 'bg-yellow-500' },
  { id: 'Payload', label: 'Payload', dotColor: 'bg-cyan-500' },
  { id: 'Weather', label: 'Weather', dotColor: 'bg-green-500' },
  { id: 'Security', label: 'Security', dotColor: 'bg-red-500', isAlert: true },
  { id: 'Networks', label: 'Networks', dotColor: 'bg-orange-500' },
  { id: 'Pilots', label: 'Pilots', dotColor: 'bg-blue-500' },
  { id: 'RID', label: 'RID', dotColor: 'bg-fuchsia-500' },
  { id: 'Settings', label: 'Settings', dotColor: 'bg-lime-500' }
];

function getFlightStatus(statusId) {
  if (statusId === 0) return { text: "GROUNDED", style: "bg-neutral-500/20 text-neutral-400" };
  if (statusId === 1) return { text: "ARMED", style: "bg-yellow-500/20 text-yellow-400 animate-pulse" };
  if (statusId === 2) return { text: "IN FLIGHT", style: "bg-green-500/20 text-green-400 font-bold" };
  return { text: "UNKNOWN", style: "bg-red-500/20 text-red-400" };
}

// ==========================================
// DRONES — telemetria live per drone connesso
// ==========================================
function DronesTab() {
  // Telemetria condivisa con MapPanel tramite lo stesso hook: un solo WebSocket
  // sotto al cofano invece di due connessioni indipendenti allo stesso canale.
  const liveDrones = useTelemetry();
  const activeDronesArray = Object.values(liveDrones);

  if (activeDronesArray.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-500 font-mono animate-pulse">
        WAITING FOR TELEMETRY CONNECTION FROM THE DRONE...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
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
    </div>
  );
}

// ==========================================
// PAYLOAD — equipaggiamento registrato per drone (non letture sensori live:
// l'onboard non trasmette ancora sensor_data via telemetria, vedi Drone.payload_sensors)
// ==========================================
function PayloadTab({ token }) {
  const liveDrones = useTelemetry();
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/fleet`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (!cancelled) setFleet(data); })
      .catch((error) => console.error("Errore caricamento flotta:", error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) return <div className="p-8 text-center text-neutral-500 font-mono">LOADING FLEET DATA...</div>;
  if (fleet.length === 0) return <div className="p-8 text-center text-neutral-500 font-mono">NO DRONES REGISTERED.</div>;

  return (
    <div className="p-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fleet.map((drone) => {
          const live = Object.values(liveDrones).find((d) => d.drone?.id === drone.id);
          return (
            <div key={drone.id} className="bg-neutral-900/60 border border-neutral-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-white">{drone.name}</span>
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${live ? "bg-green-700 text-green-100" : "bg-neutral-700 text-neutral-300"}`}>
                  {live ? "Connected" : "Offline"}
                </span>
              </div>
              <div className="text-xs text-neutral-400 mb-1">Serial: <span className="text-white font-mono">{drone.hardware_serial}</span></div>
              <div className="text-xs text-neutral-400">Payload: <span className="text-cyan-400">{drone.payload_sensors || "Not specified"}</span></div>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-neutral-500 italic mt-3">
        Registered equipment only — the onboard system does not broadcast live sensor readings (gas/thermal) over telemetry yet.
      </div>
    </div>
  );
}

// ==========================================
// WEATHER — versione compatta della stessa integrazione Open-Meteo usata in WeatherScreen.jsx
// ==========================================
function WeatherTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchWeather = async () => {
      try {
        const url = "https://api.open-meteo.com/v1/forecast?latitude=44.5811&longitude=8.9489&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=Europe%2FRome";
        const response = await fetch(url);
        if (!response.ok) throw new Error("Weather API error");
        const json = await response.json();
        if (!cancelled) {
          setData(json.current);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError("SENSOR CONNECTION ERROR");
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 120000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (error) return <div className="p-8 text-center text-red-500 font-mono">{error}</div>;
  if (!data) return <div className="p-8 text-center text-neutral-500 font-mono animate-pulse">LOADING WEATHER DATA...</div>;

  const windWarning = data.wind_speed_10m > 28;
  const gustWarning = data.wind_gusts_10m > 40;
  const isBlocked = windWarning || gustWarning;

  return (
    <div className="p-2">
      <div className={`p-3 rounded border mb-3 flex justify-between items-center ${isBlocked ? 'bg-red-950/40 border-red-500/40 text-red-400' : 'bg-green-950/20 border-green-500/30 text-green-400'}`}>
        <span className="text-xs uppercase tracking-widest text-neutral-400">UAV Flight Status</span>
        <span className="font-bold">{isBlocked ? "SUSPENDED (NO-GO)" : "OPTIMAL (GO)"}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="bg-neutral-900/60 border border-neutral-700 rounded p-3">
          <div className="text-[10px] text-neutral-500 uppercase">Wind</div>
          <div className={`text-xl font-bold ${windWarning ? "text-red-400" : "text-white"}`}>
            {data.wind_speed_10m} <span className="text-xs text-neutral-500">km/h</span>
          </div>
        </div>
        <div className="bg-neutral-900/60 border border-neutral-700 rounded p-3">
          <div className="text-[10px] text-neutral-500 uppercase">Gusts</div>
          <div className={`text-xl font-bold ${gustWarning ? "text-red-500" : "text-yellow-500"}`}>
            {data.wind_gusts_10m} <span className="text-xs text-neutral-500">km/h</span>
          </div>
        </div>
        <div className="bg-neutral-900/60 border border-neutral-700 rounded p-3">
          <div className="text-[10px] text-neutral-500 uppercase">Temp</div>
          <div className="text-xl font-bold text-white">{data.temperature_2m}°C</div>
        </div>
        <div className="bg-neutral-900/60 border border-neutral-700 rounded p-3">
          <div className="text-[10px] text-neutral-500 uppercase">Humidity</div>
          <div className="text-xl font-bold text-cyan-400">{data.relative_humidity_2m}%</div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SECURITY — registro di audit (SystemLog): clearance, blocchi NFZ, approvazioni
// ==========================================
function SecurityTab({ token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchLogs = () => {
      fetch(`${API_BASE_URL}/api/logs?limit=50`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => { if (!cancelled) setLogs(data); })
        .catch((error) => console.error("Errore caricamento log:", error))
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  const badgeStyle = (actionType) => {
    if (actionType.includes("ALERT") || actionType.includes("REJECT")) return "bg-red-900 text-red-200";
    if (actionType.includes("APPROVE") || actionType.includes("CLEAR")) return "bg-green-900 text-green-200";
    return "bg-neutral-700 text-neutral-200";
  };

  if (loading) return <div className="p-8 text-center text-neutral-500 font-mono">LOADING AUDIT LOG...</div>;
  if (logs.length === 0) return <div className="p-8 text-center text-neutral-500 font-mono">NO EVENTS RECORDED YET.</div>;

  return (
    <div className="flex flex-col gap-1 p-1">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-3 bg-neutral-900/50 border border-neutral-800 rounded px-3 py-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] shrink-0 ${badgeStyle(log.action_type)}`}>
            {log.action_type}
          </span>
          <span className="text-neutral-300 flex-1">{log.description}</span>
          <span className="text-neutral-500 font-mono shrink-0">
            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// NETWORKS — salute dei canali realtime (WebSocket telemetria + broker MQTT)
// ==========================================
function StatusRow({ label, ok, detail }) {
  return (
    <div className="flex justify-between items-center bg-neutral-900/60 border border-neutral-700 rounded px-4 py-3">
      <span className="text-sm text-neutral-300">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-xs text-neutral-500 font-mono">{detail}</span>}
        <span className={`w-2.5 h-2.5 rounded-full ${ok ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        <span className={`text-xs font-bold uppercase ${ok ? "text-green-400" : "text-red-400"}`}>
          {ok ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );
}

function NetworksTab({ token }) {
  const { connected: wsConnected, updatedAt } = useTelemetryStatus();
  const [mqttStatus, setMqttStatus] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchStatus = () => {
      fetch(`${API_BASE_URL}/api/system/status`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (!cancelled) setMqttStatus(data); })
        .catch((error) => console.error("Errore stato sistema:", error));
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  const secondsSinceLastUpdate = updatedAt ? Math.round((Date.now() - updatedAt) / 1000) : null;

  return (
    <div className="flex flex-col gap-2 p-2">
      <StatusRow
        label="Telemetry WebSocket (/ws/telemetry)"
        ok={wsConnected}
        detail={secondsSinceLastUpdate !== null ? `last packet ${secondsSinceLastUpdate}s ago` : "no data yet"}
      />
      <StatusRow label="MQTT Broker (publish channel)" ok={!!mqttStatus?.mqtt_connected} />
    </div>
  );
}

// ==========================================
// PILOTS — roster e missioni assegnate
// ==========================================
function PilotsTab({ token }) {
  const [pilots, setPilots] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE_URL}/api/pilots`, { headers }).then((res) => (res.ok ? res.json() : [])),
      fetch(`${API_BASE_URL}/api/missions`, { headers }).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([pilotsData, missionsData]) => {
        if (cancelled) return;
        setPilots(pilotsData);
        setMissions(missionsData);
      })
      .catch((error) => console.error("Errore caricamento piloti:", error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) return <div className="p-8 text-center text-neutral-500 font-mono">LOADING PILOT ROSTER...</div>;
  if (pilots.length === 0) return <div className="p-8 text-center text-neutral-500 font-mono">NO PILOTS REGISTERED.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
      {pilots.map((pilot) => {
        const assigned = missions.filter((m) => m.pilot_id === pilot.id && m.status !== "COMPLETED");
        return (
          <div key={pilot.id} className="bg-neutral-900/60 border border-neutral-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-white">{pilot.full_name}</span>
              <span className="text-xs font-mono text-neutral-500">#{pilot.badge_code}</span>
            </div>
            {assigned.length === 0 ? (
              <div className="text-xs text-neutral-500 italic">No active missions assigned.</div>
            ) : (
              <div className="flex flex-col gap-1">
                {assigned.map((m) => (
                  <div key={m.mission_id} className="text-xs flex justify-between">
                    <span className="text-neutral-300">{m.route}</span>
                    <span className="text-blue-400">{m.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// RID (Remote ID) — dati di registrazione, non un segnale broadcast reale
// (l'onboard non trasmette ancora Remote ID: vedi nota in fondo alla tab)
// ==========================================
function RIDTab({ token }) {
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/fleet`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (!cancelled) setFleet(data); })
      .catch((error) => console.error("Errore caricamento flotta RID:", error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) return <div className="p-8 text-center text-neutral-500 font-mono">LOADING REGISTRATION DATA...</div>;

  return (
    <div className="p-2">
      <table className="w-full text-left text-sm text-white">
        <thead className="text-xs uppercase text-neutral-400 border-b border-neutral-700">
          <tr>
            <th className="px-4 py-2">Drone</th>
            <th className="px-4 py-2">Hardware Serial</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {fleet.map((drone) => (
            <tr key={drone.id} className="border-b border-neutral-800 bg-neutral-900/50">
              <td className="px-4 py-2 font-bold">{drone.name}</td>
              <td className="px-4 py-2 font-mono text-xs">{drone.hardware_serial}</td>
              <td className="px-4 py-2 text-xs">{drone.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-neutral-500 italic mt-3">
        Registration data only — the onboard system does not yet broadcast a live Remote ID signal.
      </div>
    </div>
  );
}

// ==========================================
// SETTINGS — profilo utente e info di connessione
// ==========================================
function SettingsTab({ token }) {
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setMe(data); })
      .catch((error) => console.error("Errore caricamento profilo:", error));
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="p-4 flex flex-col gap-4 max-w-md">
      <div className="bg-neutral-900/60 border border-neutral-700 rounded-lg p-4">
        <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Account</div>
        {me ? (
          <div className="text-sm text-white flex flex-col gap-1">
            <span>{me.full_name} <span className="text-neutral-500 font-mono">#{me.badge_code}</span></span>
            <span className="text-blue-400 uppercase text-xs font-bold">{me.role}</span>
          </div>
        ) : (
          <div className="text-xs text-neutral-500">Loading...</div>
        )}
      </div>
      <div className="bg-neutral-900/60 border border-neutral-700 rounded-lg p-4">
        <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Connection</div>
        <div className="text-xs text-neutral-400 flex flex-col gap-1 font-mono">
          <span>API: {API_BASE_URL}</span>
        </div>
      </div>
      {me?.role === "responsabile" && (
        <div className="text-xs text-neutral-500 italic">
          User, drone, mission and No-Fly Zone management is available from the Admin panel (top right).
        </div>
      )}
    </div>
  );
}

export default function DashboardPanel({ token }) {
  const [activeTab, setActiveTab] = useState('Drones');

  const renderContent = () => {
    switch (activeTab) {
      case 'Drones':
        return <DronesTab />;
      case 'Payload':
        return <PayloadTab token={token} />;
      case 'Weather':
        return <WeatherTab />;
      case 'Security':
        return <SecurityTab token={token} />;
      case 'Networks':
        return <NetworksTab token={token} />;
      case 'Pilots':
        return <PilotsTab token={token} />;
      case 'RID':
        return <RIDTab token={token} />;
      case 'Settings':
        return <SettingsTab token={token} />;
      default:
        return <div className="p-4 text-neutral-400">Content under development.</div>;
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
