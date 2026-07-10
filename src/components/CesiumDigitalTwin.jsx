import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";

// 🏠 COORDINATE DI DEFAULT (Raffineria di Fegino)
const HOME_LON = 8.880194;
const HOME_LAT = 44.435585;
const HOME_ALT = 98.0; // Quota del terreno a Fegino

export default function CesiumDigitalTwin({ telemetry }) {
  const cesiumContainer = useRef(null);
  const viewerRef = useRef(null);
  const droneEntityRef = useRef(null);

  const [isThirdPerson, setIsThirdPerson] = useState(false);

  // 1. INIZIALIZZAZIONE AMBIENTE E POSIZIONE DI DEFAULT
  useEffect(() => {
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmMjA3OTk3Mi0wM2IwLTRjZmQtYWVlMi1iNjY5MzFlNDFhODIiLCJpZCI6NDUzODU0LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODM1MDIzMzl9.QEFFKrQ2v0K22qf-MUfsN8vKQ4wO9aFHhEY270BahFE';

    const viewer = new Cesium.Viewer(cesiumContainer.current, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      infoBox: false,
      navigationHelpButton: false,
    });
    viewerRef.current = viewer;

    // 📍 FORZIAMO LA TELECAMERA SU FEGINO ALL'AVVIO
    // In questo modo l'applicazione non si apre nello spazio
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(HOME_LON, HOME_LAT, HOME_ALT + 150), // 150 metri sopra il livello del suolo
      orientation: {
        heading: Cesium.Math.toRadians(0.0),   // Guarda verso Nord
        pitch: Cesium.Math.toRadians(-45.0),  // Inclinata a 45 gradi verso il basso
        roll: 0.0
      }
    });

    // Caricamento del Digital Twin
    const loadEnvironment = async () => {
      try {
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(5032873);
        viewer.scene.primitives.add(tileset);
      } catch (error) {
        console.error("Errore caricamento Digital Twin:", error);
      }
    };
    loadEnvironment();

    // Creazione del Drone con posizione iniziale fissa a Fegino
    droneEntityRef.current = viewer.entities.add({
      id: "uav-3d-model",
      position: Cesium.Cartesian3.fromDegrees(HOME_LON, HOME_LAT, HOME_ALT), // Posizionato a terra a Fegino
      viewFrom: new Cesium.Cartesian3(-20.0, 0.0, 8.0), 
      model: {
        uri: '/drone.glb',
        minimumPixelSize: 64,
        scale: 1.0
      },
      path: {
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.CYAN,
        }),
        leadTime: 0,
        trailTime: 10,
      }
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
      }
    };
  }, []);

  // 2. AGGIORNAMENTO TELEMETRIA DINAMICA
  useEffect(() => {
    if (telemetry && droneEntityRef.current) {
      if (telemetry.position && telemetry.position.global) {
        const lat = telemetry.position.global.latitude;
        const lon = telemetry.position.global.longitude;
        const alt = telemetry.position.global.altitude;
        
        // Evitiamo che coordinate nulle (0,0) spostino il drone nell'oceano atlantico
        if (lat !== 0 && lon !== 0) {
          const newPosition = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
          droneEntityRef.current.position = newPosition;

          if (telemetry.orientation && telemetry.orientation.euler) {
            const heading = Cesium.Math.toRadians(telemetry.orientation.euler.yaw); 
            const pitch = Cesium.Math.toRadians(telemetry.orientation.euler.pitch);
            const roll = Cesium.Math.toRadians(telemetry.orientation.euler.roll);

            const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
            droneEntityRef.current.orientation = Cesium.Transforms.headingPitchRollQuaternion(
              newPosition, 
              hpr
            );
          }
        }
      }
    }
  }, [telemetry]);

  // 3. GESTORE DELLA VISUALE (CON SICUREZZA SE IL DRONE È SCOLLEGATO)
  useEffect(() => {
    if (viewerRef.current && droneEntityRef.current) {
      // Attiviamo la terza persona SOLO se abbiamo una telemetria valida,
      // altrimenti la telecamera libera rimane attiva per evitare crash visivi
      if (isThirdPerson && telemetry) {
        viewerRef.current.trackedEntity = droneEntityRef.current;
      } else {
        viewerRef.current.trackedEntity = undefined;
        // Se disattiviamo l'inseguimento, riportiamo dolcemente la camera a guardare la raffineria
        if (!isThirdPerson) {
          viewerRef.current.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(HOME_LON, HOME_LAT, HOME_ALT + 150),
            orientation: {
              heading: Cesium.Math.toRadians(0.0),
              pitch: Cesium.Math.toRadians(-45.0),
              roll: 0.0
            },
            duration: 2.0
          });
        }
      }
    }
  }, [isThirdPerson, telemetry]);

  return (
    <div className="w-full h-full relative">
      <div ref={cesiumContainer} className="absolute inset-0 z-0" />

      {/* BOTTONE CON STATO DINAMICO */}
      <div className="absolute bottom-4 left-4 z-10">
        <button
          disabled={!telemetry} // Il bottone è disabilitato se il drone non è connesso
          onClick={() => setIsThirdPerson(!isThirdPerson)}
          className={`px-4 py-2 font-bold font-mono text-xs rounded border transition-all ${
            !telemetry 
              ? "bg-neutral-800/80 border-neutral-700 text-neutral-500 cursor-not-allowed"
              : isThirdPerson 
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" 
                : "bg-black/70 border-neutral-600 text-neutral-400 hover:border-cyan-400 hover:text-cyan-400"
          }`}
        >
          {!telemetry 
            ? "◌ UAV OFFLINE (NO LINK)" 
            : isThirdPerson 
              ? "◉ RADAR LOCK (3RD PERSON)" 
              : "◌ FREE CAMERA (TACTICAL)"}
        </button>
      </div>
    </div>
  );
}