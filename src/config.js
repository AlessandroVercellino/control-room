// src/config.js
// Unico punto in cui è definito l'indirizzo del backend.
// Override possibile con una variabile d'ambiente Vite (vedi .env.example),
// utile se un giorno backend e control-room non girano più sullo stesso PC.

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';
