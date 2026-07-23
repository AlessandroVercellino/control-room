import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";

// 🏠 COORDINATE DI DEFAULT (Raffineria di Fegino) — usate per la camera iniziale
const HOME_LON = 8.880966;
const HOME_LAT = 44.43683;
// Quota di fallback finché non campioniamo quella vera dallo splat (vedi homeGroundHeightRef):
// serve solo come valore di partenza prima che il digital twin sia caricato.
const HOME_ALT = 102.9999999997;

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

export default function CesiumDigitalTwin({ telemetry, activeMission }) {
  const cesiumContainer = useRef(null);
  const viewerRef = useRef(null);
  const droneEntityRef = useRef(null);
  const missionPathEntityRef = useRef(null);
  const waypointEntityRefs = useRef([]);
  // Quota vera del terreno a Fegino, campionata dallo splat una volta caricato
  // il tileset (vedi loadEnvironment). Finché non è pronta si usa HOME_ALT.
  const homeGroundHeightRef = useRef(HOME_ALT);
  // Evita che il ricalcolo async della quota "rubi" la posizione al drone se
  // nel frattempo è già arrivata telemetria reale (che ha sempre priorità).
  const hasReceivedTelemetryRef = useRef(false);

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

    // 💡 ILLUMINAZIONE SINCRONIZZATA CON L'ORA REALE
    // Il globo viene ombreggiato in base alla posizione reale del sole
    // all'ora corrente (viewer.clock parte già sull'ora di sistema): le
    // ombre sui serbatoi seguono quindi il sole vero, non una luce piatta finta.
    viewer.scene.globe.enableLighting = true;

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

        // 🐛 FIX QUOTA: campioniamo la vera quota del terreno a Fegino (splat
        // incluso, ora che il tileset è caricato) invece di usare HOME_ALT,
        // una costante scritta a mano che può non combaciare esattamente con
        // la superficie reale del digital twin.
        try {
          const [sampledHome] = await viewer.scene.sampleHeightMostDetailed([
            Cesium.Cartographic.fromDegrees(HOME_LON, HOME_LAT),
          ]);
          if (sampledHome?.height !== undefined) {
            homeGroundHeightRef.current = sampledHome.height;
          }
        } catch (sampleError) {
          console.error("Errore campionamento quota di Fegino:", sampleError);
        }

        // 🐛 FIX DRONE SOTTO IL DIGITAL TWIN: se non è ancora arrivata
        // telemetria reale, riposizioniamo il drone sulla quota vera appena
        // campionata — prima poteva finire leggermente sotto la superficie
        // dello splat perché usava HOME_ALT (una stima, non il dato reale).
        if (droneEntityRef.current && !hasReceivedTelemetryRef.current) {
          droneEntityRef.current.position = Cesium.Cartesian3.fromDegrees(
            HOME_LON,
            HOME_LAT,
            homeGroundHeightRef.current
          );
        }

        // 🐛 FIX VISTA INIZIALE: prima qui c'era viewer.zoomTo(tileset), che
        // SOVRASCRIVEVA a scatto secco la vista curata impostata sopra con
        // camera.setView, rimpiazzandola con un inquadramento automatico
        // generico (spesso mal angolato). Ora voliamo di nuovo, in modo
        // animato, sulla stessa vista di Fegino ma con la quota corretta.
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(HOME_LON, HOME_LAT, homeGroundHeightRef.current + 150),
          orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-45.0),
            roll: 0.0
          },
          duration: 2.5,
        });

      } catch (error) {
        console.error("Errore caricamento Digital Twin:", error);
      }
    };

    loadEnvironment();


    // Creazione del Drone con posizione iniziale fissa a Fegino
    droneEntityRef.current = viewer.entities.add({
      id: "uav-3d-model",
      position: Cesium.Cartesian3.fromDegrees(HOME_LON, HOME_LAT, HOME_ALT), // Posizione provvisoria, corretta appena lo splat è caricato (vedi loadEnvironment)
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

    // 📏 LINEA D'OMBRA VERTICALE: dal drone al punto del terreno esattamente
    // sotto di lui. In prospettiva 3D è difficile giudicare la quota AGL a
    // occhio (ce ne siamo accorti col bug del percorso); questa linea dà un
    // riferimento visivo immediato dell'altezza reale sopra il suolo.
    // CallbackProperty ricalcola le posizioni ad ogni frame leggendo la
    // posizione corrente del drone e interrogando il terreno già caricato
    // (viewer.scene.globe.getHeight è sincrono, adatto per un update continuo).
    viewer.entities.add({
      id: "drone-shadow-line",
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          if (!droneEntityRef.current) return [];
          const dronePosition = droneEntityRef.current.position.getValue(viewer.clock.currentTime);
          if (!dronePosition) return [];

          const cartographic = Cesium.Cartographic.fromCartesian(dronePosition);
          const groundHeight = viewer.scene.globe.getHeight(cartographic) ?? homeGroundHeightRef.current;
          const groundPosition = Cesium.Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            groundHeight
          );

          return [dronePosition, groundPosition];
        }, false),
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.WHITE.withAlpha(0.6),
          dashLength: 6,
        }),
      },
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
          hasReceivedTelemetryRef.current = true;
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

  // 3. ROTTA DELLA MISSIONE SELEZIONATA
  // Ridisegna il percorso ogni volta che cambia la missione attiva. Usiamo
  // mqtt_payload (Latitude/Longitude/Altitude, gli stessi dati inviati al
  // drone via MQTT) invece del semplice array "waypoints" del Leaflet 2D,
  // perché qui in 3D serve anche la quota di ogni waypoint.
  // Nota: questi dati vengono dal database (piano di missione), non dalla
  // telemetria — la rotta si vede quindi anche a drone spento/scollegato.
  //
  // 🐛 FIX ALLINEAMENTO: l'Altitude del piano UgCS è relativa al punto di
  // decollo (AGL), NON quota assoluta sul livello del mare come invece è la
  // telemetria del drone. Usarla come se fosse assoluta piazzava il percorso
  // a un'altezza reale sbagliata — con la camera inclinata questo si vede
  // come uno spostamento LATERALE sullo schermo, non solo verticale (un
  // punto piazzato troppo in basso "scivola" di lato nella proiezione).
  // Soluzione: campioniamo la vera quota del terreno sotto ogni waypoint dal
  // terrain provider già caricato, e ci sommiamo l'altitudine relativa.
  //
  // 🐛 FIX PRECISIONE: il terrain provider globale (Cesium World Terrain) non
  // conosce lo splat fotogrammetrico del sito — sa solo la quota approssimata
  // del terreno "vero", non i piazzali/vasche modellati nel digital twin. Su
  // un sito con terreno lavorato questo scarto residuo (anche solo di qualche
  // metro) si legge ancora come spostamento laterale con la camera inclinata.
  // scene.sampleHeightMostDetailed interroga la SCENA renderizzata (tileset
  // dello splat incluso, non solo il terreno generico), quindi allinea il
  // percorso alla quota reale del modello 3D che vedi, non a un dato globale.
  useEffect(() => {
    if (!viewerRef.current) return;

    // Rimuovi sempre il tracciato e i marker precedenti prima di ridisegnare (o se la missione è stata deselezionata)
    if (missionPathEntityRef.current) {
      viewerRef.current.entities.remove(missionPathEntityRef.current);
      missionPathEntityRef.current = null;
    }
    waypointEntityRefs.current.forEach((entity) => viewerRef.current.entities.remove(entity));
    waypointEntityRefs.current = [];

    const waypoints = activeMission?.mqtt_payload;
    if (!waypoints || waypoints.length < 2) return;

    let cancelled = false;

    const drawPath = async () => {
      const cartographics = waypoints.map((wp) =>
        Cesium.Cartographic.fromDegrees(parseFloat(wp.Longitude), parseFloat(wp.Latitude))
      );

      let sampled;
      try {
        sampled = await viewerRef.current.scene.sampleHeightMostDetailed(cartographics);
      } catch (error) {
        console.error("Errore campionamento scena per il percorso missione:", error);
        try {
          // Fallback: se il campionamento della scena non è supportato (richiede WebGL2
          // o depth texture), proviamo almeno col terreno generico globale.
          sampled = await Cesium.sampleTerrainMostDetailed(viewerRef.current.terrainProvider, cartographics);
        } catch (fallbackError) {
          console.error("Errore anche nel fallback terreno globale:", fallbackError);
          sampled = cartographics; // ultima spiaggia: usiamo la quota di Fegino più sotto
        }
      }

      if (cancelled) return;

      const positions = sampled.map((carto, i) => {
        const groundHeight = carto.height ?? HOME_ALT;
        const relativeAltitude = parseFloat(waypoints[i].Altitude) || 0;
        return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, groundHeight + relativeAltitude);
      });

      if (cancelled) return;

      missionPathEntityRef.current = viewerRef.current.entities.add({
        id: "mission-path",
        polyline: {
          positions,
          width: 4,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.CYAN,
            dashLength: 16,
          }),
        },
      });

      // 🔢 MARKER NUMERATI: un punto con etichetta per ogni waypoint, stessa
      // quota (terreno reale + altitudine relativa) già usata per il percorso.
      // Il colore viene poi aggiornato dall'effetto di evidenziazione qui sotto
      // in base a quale waypoint è il più vicino al drone in questo momento.
      waypointEntityRefs.current = positions.map((position, index) =>
        viewerRef.current.entities.add({
          id: `mission-waypoint-${index}`,
          position,
          point: {
            pixelSize: 10,
            color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: String(index + 1),
            font: '12px "JetBrains Mono", monospace',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
      );
    };

    drawPath();

    return () => {
      cancelled = true;
    };
  }, [activeMission]);

  // 4. EVIDENZIAZIONE DEL WAYPOINT PIÙ VICINO AL DRONE
  // Approssimazione semplice ma utile: ad ogni aggiornamento di telemetria,
  // troviamo il marker più vicino alla posizione attuale del drone e lo
  // evidenziamo (più grande, giallo). Non è un vero "prossimo waypoint della
  // missione in corso" (richiederebbe che il drone riportasse l'indice di
  // missione attivo), ma dà comunque un riferimento visivo immediato di dove
  // si trova il drone rispetto al piano di volo.
  useEffect(() => {
    if (!viewerRef.current || waypointEntityRefs.current.length === 0) return;
    if (!telemetry || !telemetry.position || !telemetry.position.global) return;

    const { latitude, longitude, altitude } = telemetry.position.global;
    if (latitude === 0 && longitude === 0) return;

    const dronePosition = Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude || 0);

    let closestIndex = -1;
    let closestDistance = Infinity;
    waypointEntityRefs.current.forEach((entity, index) => {
      const waypointPosition = entity.position.getValue(viewerRef.current.clock.currentTime);
      if (!waypointPosition) return;
      const distance = Cesium.Cartesian3.distance(dronePosition, waypointPosition);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    waypointEntityRefs.current.forEach((entity, index) => {
      const isClosest = index === closestIndex;
      entity.point.color = isClosest ? Cesium.Color.YELLOW : Cesium.Color.CYAN;
      entity.point.pixelSize = isClosest ? 16 : 10;
    });
  }, [telemetry]);

  // 5. GESTORE DELLA VISUALE (CON SICUREZZA SE IL DRONE È SCOLLEGATO)
  // 🐛 FIX TRANSIZIONE BRUSCA: prima l'aggancio in terza persona era un
  // singolo assegnamento a trackedEntity — nessuna animazione, la camera si
  // teletrasportava di scatto sul drone con un angolo/distanza qualunque
  // (quello che capitava di avere in quel momento). Ora voliamo con flyTo
  // fino a un'inquadratura "da inseguimento" definita (dietro/sopra il
  // drone), e solo ad animazione conclusa agganciamo trackedEntity per
  // continuare a seguirlo — che poi Cesium gestisce da solo, senza bisogno
  // di ripetere la flyTo ad ogni tick di telemetria.
  //
  // Nota sulla dipendenza: usiamo hasTelemetry (booleano) invece
  // dell'oggetto telemetry intero. L'oggetto cambia riferimento ad ogni
  // singolo pacchetto ricevuto (più volte al secondo): se lo mettessimo tra
  // le dipendenze, la flyTo ripartirebbe da capo ad ogni tick invece che
  // solo quando si entra/esce davvero dalla terza persona.
  const hasTelemetry = Boolean(telemetry);

  useEffect(() => {
    if (!viewerRef.current || !droneEntityRef.current) return;

    let cancelled = false;

    // Attiviamo la terza persona SOLO se abbiamo una telemetria valida,
    // altrimenti la telecamera libera rimane attiva per evitare crash visivi
    if (isThirdPerson && hasTelemetry) {
      viewerRef.current
        .flyTo(droneEntityRef.current, {
          duration: 1.5,
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(-30.0), // leggermente di lato, non dritto da nord
            Cesium.Math.toRadians(-25.0), // inclinata verso il basso, non troppo dall'alto
            45.0 // metri di distanza — vista da "inseguimento", non incollata al drone
          ),
        })
        .then(() => {
          // Se nel frattempo l'utente ha già disattivato la terza persona
          // (o il componente si è smontato), non riagganciare il tracking
          if (!cancelled && viewerRef.current) {
            viewerRef.current.trackedEntity = droneEntityRef.current;
          }
        });
    } else {
      viewerRef.current.trackedEntity = undefined;
      // Se disattiviamo l'inseguimento, riportiamo dolcemente la camera a guardare la raffineria
      if (!isThirdPerson) {
        viewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(HOME_LON, HOME_LAT, homeGroundHeightRef.current + 150),
          orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-45.0),
            roll: 0.0
          },
          duration: 2.0
        });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [isThirdPerson, hasTelemetry]);

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