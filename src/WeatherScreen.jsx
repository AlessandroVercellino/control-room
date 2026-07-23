import React, { useState, useEffect } from 'react';

export default function WeatherScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const compassDirection = (deg) => {
    const idx = Math.round(deg / 45) % 8;
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][idx];
  };

  const fetchWeatherData = async () => {
    try {
      const url = "https://api.open-meteo.com/v1/forecast?latitude=44.5811&longitude=8.9489&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=Europe%2FRome";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Errore API Meteo");
      
      const resJson = await response.json();
      setData(resJson.current);
      setError(null);
    } catch (err) {
      setError("SENSOR CONNECTION ERROR");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherData();
    const interval = setInterval(fetchWeatherData, 120000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center text-neutral-500 font-mono">
        <div className="text-xl tracking-widest">LOADING WEATHER DATA...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center text-red-500 font-mono">
        <div className="text-2xl font-bold tracking-widest border border-red-500 p-8 bg-red-950/20">{error}</div>
      </div>
    );
  }

  const windWarning = data.wind_speed_10m > 28;
  const gustWarning = data.wind_gusts_10m > 40;
  const isUavBlocked = windWarning || gustWarning;

  return (
    <div className="h-screen w-screen bg-[#0f0f11] text-white p-6 flex flex-col font-mono select-none overflow-hidden">
      
      {/* HEADER PIATTO E PULITO */}
      <div className="border-b-2 border-neutral-800 pb-4 flex justify-between items-end mb-6">
        <div>
          <div className="text-cyan-500 text-xs tracking-[0.2em] mb-2">MONITOR_02 // ENVIRONMENTAL CONDITIONS</div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-100">IPLOM REFINERY (GE)</h1>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-700 px-4 py-2 rounded">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-bold text-neutral-300">{new Date(data.time).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* STATUS BAR */}
      <div className={`p-4 rounded border mb-6 flex justify-between items-center ${
        isUavBlocked 
          ? 'bg-red-950/50 border-red-500/50 text-red-400' 
          : 'bg-green-950/30 border-green-500/30 text-green-400'
      }`}>
        <div className="flex items-center gap-4">
          <div className="text-xs uppercase tracking-widest text-neutral-400">UAV Flight Status:</div>
          <div className="text-xl font-bold">{isUavBlocked ? "OPERATIONS SUSPENDED (NO-GO)" : "OPTIMAL CONDITIONS (GO)"}</div>
        </div>
      </div>

      {/* LAYOUT PRINCIPALE */}
      <div className="flex gap-6 flex-1 min-h-0">
        
        {/* COLONNA DATI (Sinistra) */}
        <div className="w-1/3 flex flex-col gap-6">
          
          {/* VENTO */}
          <div className={`flex-1 bg-neutral-900 border rounded-lg p-5 flex flex-col justify-between ${windWarning ? 'border-red-500/50' : 'border-neutral-800'}`}>
            <div className="text-xs text-neutral-500 uppercase tracking-widest">Wind Speed</div>
            <div className="my-auto">
              <span className={`text-7xl font-bold ${windWarning ? 'text-red-400' : 'text-white'}`}>{data.wind_speed_10m}</span>
              <span className="text-xl text-neutral-500 ml-2">km/h</span>
            </div>
            <div className="text-sm text-neutral-400 border-t border-neutral-800 pt-3">
              Dir: <span className="text-cyan-400 font-bold">{data.wind_direction_10m}° {compassDirection(data.wind_direction_10m)}</span>
            </div>
          </div>

          {/* GUSTS */}
          <div className={`flex-1 bg-neutral-900 border rounded-lg p-5 flex flex-col justify-between ${gustWarning ? 'border-red-500/50' : 'border-neutral-800'}`}>
            <div className="text-xs text-neutral-500 uppercase tracking-widest">Max Gusts</div>
            <div className="my-auto">
              <span className={`text-7xl font-bold ${gustWarning ? 'text-red-500' : 'text-yellow-500'}`}>{data.wind_gusts_10m}</span>
              <span className="text-xl text-neutral-500 ml-2">km/h</span>
            </div>
            <div className="text-sm text-neutral-500 border-t border-neutral-800 pt-3">
              Safety Limit: 40 km/h
            </div>
          </div>

          {/* TERMODINAMICA PICCOLA */}
          <div className="h-1/3 bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col justify-center gap-2">
             <div className="flex justify-between items-end border-b border-neutral-800 pb-2">
               <span className="text-xs text-neutral-500 uppercase">Temp</span>
               <span className="text-2xl font-bold text-white">{data.temperature_2m}°C</span>
             </div>
             <div className="flex justify-between items-end border-b border-neutral-800 pb-2">
               <span className="text-xs text-neutral-500 uppercase">Humidity</span>
               <span className="text-2xl font-bold text-cyan-400">{data.relative_humidity_2m}%</span>
             </div>
             <div className="flex justify-between items-end">
               <span className="text-xs text-neutral-500 uppercase">Precip.</span>
               <span className="text-2xl font-bold text-blue-400">{data.precipitation} mm</span>
             </div>
          </div>
        </div>

        {/* COLONNA MAPPA WINDY (Destra) */}
        <div className="w-2/3 bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col">
          <div className="text-xs text-neutral-500 uppercase tracking-widest mb-3 flex justify-between">
            <span>Dynamic Radar - ECMWF Model</span>
            <span>ZOOM: 11</span>
          </div>
          <div className="flex-1 w-full rounded border border-neutral-800 overflow-hidden bg-black">
            <iframe 
              title="Windy Radar"
              width="100%" 
              height="100%" 
              src="https://embed.windy.com/embed2.html?lat=44.581&lon=8.949&detailLat=44.581&detailLon=8.949&width=650&height=450&zoom=11&level=surface&overlay=wind&product=ecmwf&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1"
              frameBorder="0"
              className="w-full h-full"
            ></iframe>
          </div>
        </div>

      </div>
    </div>
  );
}