import React, { useState, useEffect } from 'react';
import AdminNFZManager from './AdminNFZManager';
import { API_BASE_URL } from '../config';

export default function AdminPanel({ token, onClose,onMissionUploaded }) {
  // Stati per scaricare i dati necessari dai menu a tendina
  const [users, setUsers] = useState([]);
  const [drones, setDrones] = useState([]);

  // Stati per i form
  const [userForm, setUserForm] = useState({ full_name: '', badge_code: '', codice_fiscale: '', role: 'pilota', password: '' });
  const [droneForm, setDroneForm] = useState({ name: '', hardware_serial: '', payload_sensors: '' });
  
  // Stati per le Missioni
  const [missionForm, setMissionForm] = useState({ route_name: '', drone_id: '', pilot_id: '' });
  const [selectedFile, setSelectedFile] = useState(null);

  // NUOVI STATI PER LE NO-FLY ZONE
  const [nfzForm, setNfzForm] = useState({ name: '', description: '' });
  const [selectedNfzFile, setSelectedNfzFile] = useState(null);

  useEffect(() => {
    const authHeaders = { headers: { "Authorization": `Bearer ${token}` } };
    fetch(`${API_BASE_URL}/api/users`, authHeaders).then(res => res.json()).then(setUsers);
    fetch(`${API_BASE_URL}/api/drones`, authHeaders).then(res => res.json()).then(setDrones);
  }, [token]);

  // --- GESTIONE INVIO DATI ---

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userForm)
    });

    if (response.ok) {
        alert(`User ${userForm.full_name} added!`);
        setUserForm({ full_name: '', badge_code: '', codice_fiscale: '', role: 'pilota', password: '' });
        fetch(`${API_BASE_URL}/api/users`, { headers: { "Authorization": `Bearer ${token}` } }).then(res => res.json()).then(setUsers);
    } else {
        alert("Error creating the user. Check that the badge code or fiscal code aren't already registered.");
    }
  };

  const handleDroneSubmit = async (e) => {
    e.preventDefault();
    await fetch(`${API_BASE_URL}/api/drones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(droneForm)
    });
    alert(`Drone ${droneForm.name} added to the fleet!`);
    setDroneForm({ name: '', hardware_serial: '', payload_sensors: '' });
    fetch(`${API_BASE_URL}/api/drones`, { headers: { "Authorization": `Bearer ${token}` } }).then(res => res.json()).then(setDrones);
  };

  const handleMissionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("You must select a UgCS JSON file!");
      return;
    }

    const formData = new FormData();
    formData.append('route_name', missionForm.route_name);
    formData.append('drone_id', missionForm.drone_id);
    formData.append('pilot_id', missionForm.pilot_id);
    formData.append('file', selectedFile);

    const response = await fetch(`${API_BASE_URL}/api/missions/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    
    if(response.ok) {
        alert("Mission uploaded to the database and ready for flight!");
        setMissionForm({ route_name: '', drone_id: '', pilot_id: '' });
        setSelectedFile(null);
        if(onMissionUploaded) onMissionUploaded(); // Notifica al componente genitore che una missione è stata caricata
    } else {
        const errorData = await response.json();
        alert(errorData.detail || "Error uploading the mission");
    }
  };

  // NUOVA FUNZIONE: GESTIONE UPLOAD NO-FLY ZONE
  const handleNfzSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNfzFile) {
      alert("You must select the No-Fly Zone JSON file!");
      return;
    }

    const formData = new FormData();
    formData.append('name', nfzForm.name);
    formData.append('description', nfzForm.description);
    formData.append('file', selectedNfzFile);

    const response = await fetch(`${API_BASE_URL}/api/nfz/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if(response.ok) {
        alert(`No-Fly Zone "${nfzForm.name}" successfully activated!`);
        setNfzForm({ name: '', description: '' });
        setSelectedNfzFile(null);
    } else {
        const errorData = await response.json();
        alert(errorData.detail || "Error activating the No-Fly Zone");
    }
  };

  return (
    <div className="absolute inset-0 bg-neutral-900 z-[3000] p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 border-b border-neutral-700 pb-4">
          <h1 className="text-3xl font-bold text-white">Database Administration Panel</h1>
          <button onClick={onClose} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold transition">
            Close and Return to Map
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* COLONNA 1: UTENTI */}
           <div className="bg-neutral-800 border border-neutral-700 p-5 rounded-xl shadow-lg">
            <h2 className="text-xl text-blue-400 font-bold mb-4">New User</h2>
            <form onSubmit={handleUserSubmit} className="flex flex-col gap-3">
              <input required type="text" placeholder="Full Name" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={userForm.full_name} onChange={e => setUserForm({...userForm, full_name: e.target.value})} />
              <input required type="text" placeholder="Fiscal Code" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600 uppercase" value={userForm.codice_fiscale} onChange={e => setUserForm({...userForm, codice_fiscale: e.target.value.toUpperCase()})} />
              <input required type="text" placeholder="Badge Code (User)" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={userForm.badge_code} onChange={e => setUserForm({...userForm, badge_code: e.target.value})} />
              <input required type="password" placeholder="Access Password" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />

              <select className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
              <option value="pilota">UAS Pilot</option>
              <option value="responsabile">Room Manager</option>
              <option value="spettatore">Observer</option>
              </select>
              <button type="submit" className="bg-blue-600 text-white font-bold p-2 rounded hover:bg-blue-500 transition mt-2">Save User</button>
           </form>
          </div>

          {/* COLONNA 2: DRONI */}
          <div className="bg-neutral-800 border border-neutral-700 p-5 rounded-xl shadow-lg">
            <h2 className="text-xl text-green-400 font-bold mb-4">Register Drone</h2>
            <form onSubmit={handleDroneSubmit} className="flex flex-col gap-3">
              <input required type="text" placeholder="Model (e.g. DJI Matrice 300)" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={droneForm.name} onChange={e => setDroneForm({...droneForm, name: e.target.value})} />
              <input required type="text" placeholder="Hardware Serial" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={droneForm.hardware_serial} onChange={e => setDroneForm({...droneForm, hardware_serial: e.target.value})} />
              <input type="text" placeholder="Payload Sensors" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={droneForm.payload_sensors} onChange={e => setDroneForm({...droneForm, payload_sensors: e.target.value})} />
              <button type="submit" className="bg-green-600 text-white font-bold p-2 rounded hover:bg-green-500 transition mt-2">Save Drone</button>
            </form>
          </div>

          {/* COLONNA 3: CARICAMENTO MISSIONI */}
          <div className="bg-neutral-800 border border-neutral-700 p-5 rounded-xl shadow-lg">
            <h2 className="text-xl text-yellow-400 font-bold mb-4">Upload Mission (UgCS)</h2>
            <form onSubmit={handleMissionSubmit} className="flex flex-col gap-3">
              <input required type="text" placeholder="Route Name" className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={missionForm.route_name} onChange={e => setMissionForm({...missionForm, route_name: e.target.value})} />

              <select required className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={missionForm.pilot_id} onChange={e => setMissionForm({...missionForm, pilot_id: e.target.value})}>
                <option value="">-- Select Assigned Pilot --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select>

              <select required className="bg-neutral-900 text-white p-2 rounded border border-neutral-600" value={missionForm.drone_id} onChange={e => setMissionForm({...missionForm, drone_id: e.target.value})}>
                <option value="">-- Select Drone --</option>
                {drones.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>

              <div className="border-2 border-dashed border-neutral-500 rounded-lg p-4 text-center mt-2 bg-neutral-900 relative hover:bg-neutral-800 transition">
                <input
                  type="file"
                  accept=".json"
                  onChange={e => setSelectedFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-neutral-400 pointer-events-none">
                  {selectedFile ? (
                    <span className="text-yellow-400 font-bold">{selectedFile.name}</span>
                  ) : (
                    <span>Click or drag the .json file</span>
                  )}
                </div>
              </div>

              <button type="submit" className="bg-yellow-600 text-white font-bold p-2 rounded hover:bg-yellow-500 transition mt-2">Upload to Database</button>
            </form>
          </div>
        </div>
      
      {/* SEZIONE NO-FLY ZONE */}
      <div className="mt-8">
        <AdminNFZManager token={token} />
      </div>

      </div>
    </div>
  );
}