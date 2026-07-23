// src/hooks/useTelemetry.js
// Hook condiviso per la telemetria live via WebSocket.
//
// Prima MapPanel e DashboardPanel aprivano CIASCUNO la propria connessione a
// /ws/telemetry: il backend trasmetteva quindi la stessa telemetria due volte,
// una per client. Qui invece la connessione è un singleton a livello di modulo:
// il primo componente che monta il hook apre il socket, gli altri si limitano
// ad "ascoltare" gli stessi dati, e il socket si chiude solo quando l'ultimo
// componente che lo usa si smonta.
import { useEffect, useState } from 'react';
import { WS_BASE_URL } from '../config';

let sharedSocket = null;
let latestDrones = {};
let latestConnected = false;
let latestUpdatedAt = null; // timestamp (ms) dell'ultimo pacchetto ricevuto, per la tab Networks
const listeners = new Set();
const connectionListeners = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener(latestDrones));
}

function notifyConnectionListeners() {
  connectionListeners.forEach((listener) => listener({ connected: latestConnected, updatedAt: latestUpdatedAt }));
}

function ensureSocket() {
  if (sharedSocket) return;

  sharedSocket = new WebSocket(`${WS_BASE_URL}/ws/telemetry`);

  sharedSocket.onopen = () => {
    console.log("🟢 Connesso al WebSocket della Telemetria (condiviso)");
    latestConnected = true;
    notifyConnectionListeners();
  };

  sharedSocket.onmessage = (event) => {
    try {
      const telemetria = JSON.parse(event.data);
      const droneId = telemetria.drone.id;
      latestDrones = { ...latestDrones, [droneId]: telemetria };
      latestUpdatedAt = Date.now();
      notifyListeners();
      notifyConnectionListeners();
    } catch (error) {
      console.error("Errore lettura dati telemetria:", error);
    }
  };

  sharedSocket.onclose = () => {
    console.log("🔴 Connessione WebSocket telemetria persa.");
    sharedSocket = null;
    latestConnected = false;
    notifyConnectionListeners();
  };

  sharedSocket.onerror = () => {
    sharedSocket = null;
    latestConnected = false;
    notifyConnectionListeners();
  };
}

/**
 * Restituisce la mappa { droneId: ultimoPacchettoTelemetria } aggiornata in
 * tempo reale. Più componenti possono chiamare questo hook contemporaneamente:
 * condivideranno lo stesso socket verso il backend.
 */
export function useTelemetry() {
  const [liveDrones, setLiveDrones] = useState(latestDrones);

  useEffect(() => {
    ensureSocket();
    listeners.add(setLiveDrones);
    // Allinea subito lo stato locale nel caso i dati siano già arrivati prima del mount
    setLiveDrones(latestDrones);

    return () => {
      listeners.delete(setLiveDrones);
      if (listeners.size === 0 && sharedSocket) {
        sharedSocket.close();
        sharedSocket = null;
        latestDrones = {};
      }
    };
  }, []);

  return liveDrones;
}

/**
 * Stato "di rete" del canale telemetria, per la tab Networks: se il
 * WebSocket è aperto e quando è arrivato l'ultimo pacchetto. Condivide lo
 * stesso socket di useTelemetry (non ne apre uno nuovo).
 */
export function useTelemetryStatus() {
  const [status, setStatus] = useState({ connected: latestConnected, updatedAt: latestUpdatedAt });

  useEffect(() => {
    ensureSocket();
    connectionListeners.add(setStatus);
    setStatus({ connected: latestConnected, updatedAt: latestUpdatedAt });

    return () => {
      connectionListeners.delete(setStatus);
    };
  }, []);

  return status;
}
