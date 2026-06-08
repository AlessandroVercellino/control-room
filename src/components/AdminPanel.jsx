import React, { useState, useEffect } from 'react';

export default function AdminPanel({ token, onClose }) {
  // Stati per scaricare i dati necessari dai menu a tendina
  const [users, setUsers] = useState([]);
  const [drones, setDrones] = useState([]);

  // Stati per i form
  const [userForm, setUserForm] = useState({ full_name: '', badge_code: '', role: 'pilota' });
  const [droneForm, setDroneForm] = useState({ name: '', hardware_serial: '', payload_sensors: '' });
  
  // Stato per la missione (incluso il file)
  const [missionForm, setMissionForm] = useState({ route_name: '', drone_id: '', pilot_id: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/users').then(res => res.json()).then(setUsers);
    fetch('http://127.0.0.1:8000/api/drones').then(res => res.json()).then(setDrones);
  }, []);

  // --- GESTIONE INVIO DATI ---

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    await fetch('http://127.0.0.1:8000/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm)
    });
    alert(`Utente ${userForm.full_name} aggiunto!`);
    setUserForm({ full_name: '', badge_code: '', role: 'pilota',password: '' });
    fetch('http://127.0.0.1:8000/api/users').then(res => res.json()).then(setUsers); // Aggiorna la lista
  };

  const handleDroneSubmit = async (e) => {
    e.preventDefault();
    await fetch('http://127.0.0.1:8000/api/drones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(droneForm)
    });
    alert(`Drone ${droneForm.name} aggiunto alla flotta!`);
    setDroneForm({ name: '', hardware_serial: '', payload_sensors: '' });
    fetch('http://127.0.0.1:8000/api/drones').then(res => res.json()).then(setDrones);
  };

  const handleMissionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Devi selezionare un file JSON di UgCS!");
      return;
    }

    // Per inviare file e testi insieme, serve FormData
    const formData = new FormData();
    formData.append('route_name', missionForm.route_name);
    formData.append('drone_id', missionForm.drone_id);
    formData.append('pilot_id', missionForm.pilot_id);
    formData.append('file', selectedFile);

    const response = await fetch('http://127.0.0.1:8000/api/missions/upload', {
      method: 'POST',
      body: formData,
    });
    
    if(response.ok) {
        alert("Missione caricata nel Database e pronta al volo!");
        setMissionForm({ route_name: '', drone_id: '', pilot_id: '' });
        setSelectedFile(null);
    }
  };

  return (
    <div className="absolute inset-0 bg-neutral-900 z-[3000] p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 border-b border-neutral-700 pb-4">
          <h1 className="text-3xl font-bold text-white">⚙️ Pannello di Amministrazione Database</h1>
          <button onClick={onClose} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold transition">
            Chiudi e Torna alla Mappa
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* COLONNA 1: UTENTI */}
           <div className="bg-neutral-800 border border-neutral-700 p-5 rounded-xl shadow-lg">
            <h2 className="text-xl text-blue-400 font-bold mb-4">👤 Nuovo Utente</h2>
            <form onSubmit={handleUserSubmit} className="flex flex-col gap-3">
            <input required type="text" placeholder="Nome Cognome" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={userForm.full_name} onChange={e => setUserForm({...userForm, full_name: e.target.value})} />
            <input required type="text" placeholder="Codice Badge (User)" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={userForm.badge_code} onChange={e => setUserForm({...userForm, badge_code: e.target.value})} />
    
             {/* NUOVO CAMPO PASSWORD */}
            <input required type="password" placeholder="Password Accesso" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
    
            <select className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
             <option value="pilota">Pilota Uas</option>
             <option value="responsabile">Responsabile Sala</option>
             <option value="spettatore">Spettatore</option>
            </select>
            <button type="submit" className="bg-blue-600 text-white font-bold p-2 rounded hover:bg-blue-500 transition mt-2">Salva Utente</button>
           </form>
        </div>

          {/* COLONNA 2: DRONI */}
          <div className="bg-neutral-800 border border-neutral-700 p-5 rounded-xl shadow-lg">
            <h2 className="text-xl text-green-400 font-bold mb-4">Registra Drone</h2>
            <form onSubmit={handleDroneSubmit} className="flex flex-col gap-3">
              <input required type="text" placeholder="Modello (es. DJI Matrice 300)" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={droneForm.name} onChange={e => setDroneForm({...droneForm, name: e.target.value})} />
              <input required type="text" placeholder="Seriale Hardware" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={droneForm.hardware_serial} onChange={e => setDroneForm({...droneForm, hardware_serial: e.target.value})} />
              <input type="text" placeholder="Sensori Payload (es. Termocamera, Lidar)" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={droneForm.payload_sensors} onChange={e => setDroneForm({...droneForm, payload_sensors: e.target.value})} />
              <button type="submit" className="bg-green-600 text-white font-bold p-2 rounded hover:bg-green-500 transition mt-2">Salva Drone</button>
            </form>
          </div>

          {/* COLONNA 3: CARICAMENTO MISSIONI */}
          <div className="bg-neutral-800 border border-neutral-700 p-5 rounded-xl shadow-lg">
            <h2 className="text-xl text-yellow-400 font-bold mb-4">Upload Mission(UgCS)</h2>
            <form onSubmit={handleMissionSubmit} className="flex flex-col gap-3">
              <input required type="text" placeholder="Nome della Rotta (es. Controllo Tubazioni)" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={missionForm.route_name} onChange={e => setMissionForm({...missionForm, route_name: e.target.value})} />
              
              <select required className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={missionForm.pilot_id} onChange={e => setMissionForm({...missionForm, pilot_id: e.target.value})}>
                <option value="">-- Seleziona Pilota Incaricato --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select>

              <select required className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={missionForm.drone_id} onChange={e => setMissionForm({...missionForm, drone_id: e.target.value})}>
                <option value="">-- Seleziona Drone --</option>
                {drones.map(d => <option key={d.id} value={d.id}>{d.name} [{d.payload_sensors}]</option>)}
              </select>

              {/* AREA FILE DRAG & DROP / BROWSE */}
              <div className="border-2 border-dashed border-neutral-500 rounded-lg p-4 text-center mt-2 bg-neutral-900 relative">
                <input 
                  type="file" 
                  accept=".json"
                  onChange={e => setSelectedFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-neutral-400 pointer-events-none">
                  {selectedFile ? (
                    <span className="text-yellow-400 font-bold">📄 {selectedFile.name}</span>
                  ) : (
                    <span>Clicca qui o trascina il file .json</span>
                  )}
                </div>
              </div>

              <button type="submit" className="bg-yellow-600 text-white font-bold p-2 rounded hover:bg-yellow-500 transition mt-2">Carica nel Database</button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}