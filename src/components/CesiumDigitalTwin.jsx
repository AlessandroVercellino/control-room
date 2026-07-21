import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";

// 🏠 COORDINATE DI DEFAULT (Raffineria di Fegino) — usate SOLO per la camera iniziale
const HOME_LON = 8.880966;
const HOME_LAT = 44.43683;
const HOME_ALT = 102.9999999997; // Quota del terreno a Fegino

// ============================================================================
// 🎯 ORIGINE DI GEOREFERENZIAZIONE DEL DIGITAL TWIN (splat/tileset)
// ----------------------------------------------------------------------------
// Questi valori NON vanno indovinati: sono l'output dello script Python di
// georeferenziazione (georeference_splat.py) che calcola la trasformazione di
// similarità (scala + rotazione + traslazione) dalle pose camera RealityCapture
// confrontate con i GPS EXIF delle foto del drone.
//
// Lo script trasforma tutti i punti dello splat in coordinate locali ENU
// (East-North-Up, in metri) centrate su questa origine. Qui in Cesium basta
// una sola trasformazione standard (eastNorthUpToFixedFrame) per posizionare
// l'intero tileset nel punto giusto del globo, con l'orientamento corretto:
// NON serve più nessuna rotazione o scala "a mano".
//
// ⚠️ SOSTITUISCI questi tre valori con quelli stampati in output dallo script
// Python quando lo lanci sui tuoi file reali (registration.csv + foto + .ply).
// ============================================================================
const TILESET_ORIGIN_LON = 8.880966;   // <-- placeholder, sostituisci con l'output dello script
const TILESET_ORIGIN_LAT = 44.43683;   // <-- placeholder, sostituisci con l'output dello script
const TILESET_ORIGIN_ALT = 102.9999999997; // <-- placeholder, sostituisci con l'output dello script

// ID dell'asset Cesium ion del tileset generato dallo splat georeferenziato
const DIGITAL_TWIN_ASSET_ID = 5075529;

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
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(DIGITAL_TWIN_ASSET_ID);

        // --- NIENTE TRASFORMAZIONE MANUALE ---
        // Il tileset su Cesium ion e' GIA' georeferenziato correttamente
        // (lo vediamo posizionato bene nel preview di ion stesso): la
        // trasformazione ENU -> ECEF e' gia' incorporata nel tileset.json
        // generato da ion durante la elaborazione dell'asset.
        //
        // Applicare qui in piu' un'altra Cesium.Transforms.eastNorthUpToFixedFrame
        // la SOMMEREBBE a quella gia' presente nel tileset, raddoppiando la
        // trasformazione e mandando il modello in una posizione completamente
        // sbagliata (spesso vicino al centro della Terra, in coordinate ECEF
        // vicine a (0,0,0)) - motivo per cui il modello e' "sparito nel vuoto"
        // nella control room mentre nel preview di ion era perfetto.
        //
        // Se in futuro caricherai un tileset NON pre-georeferenziato da ion
        // (es. un tileset generico senza geo-reference specificato in fase di
        // upload), allora servira' impostare qui:
        //   const originCartesian = Cesium.Cartesian3.fromDegrees(
        //     TILESET_ORIGIN_LON, TILESET_ORIGIN_LAT, TILESET_ORIGIN_ALT
        //   );
        //   tileset.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian);
        // ma NON in aggiunta a una georeferenziazione gia' presente nel tileset.

        // Aggiungiamo alla scena
        viewer.scene.primitives.add(tileset);

        // Facciamo volare la telecamera sul modello per centrarlo subito
        viewer.zoomTo(tileset);

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