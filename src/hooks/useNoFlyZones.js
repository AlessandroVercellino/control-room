// src/hooks/useNoFlyZones.js
// Hook condiviso per leggere le No-Fly Zone dal backend.
// Prima MapPanel.jsx e AdminNFZManager.jsx avevano ciascuno una copia quasi
// identica di questa logica di fetch; qui vive in un solo posto.
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

/**
 * @param {string} token - JWT dell'utente loggato (l'endpoint /api/nfz richiede auth)
 * @param {{ pollIntervalMs?: number }} options - se specificato, ri-fetcha a intervalli regolari
 */
export function useNoFlyZones(token, { pollIntervalMs } = {}) {
  const [noFlyZones, setNoFlyZones] = useState([]);

  const fetchNFZ = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/nfz`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNoFlyZones(data);
      }
    } catch (error) {
      console.error("Errore nel caricamento delle No-Fly Zone:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchNFZ();
    if (!pollIntervalMs) return undefined;
    const intervalId = setInterval(fetchNFZ, pollIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchNFZ, pollIntervalMs]);

  return { noFlyZones, refetchNFZ: fetchNFZ };
}
