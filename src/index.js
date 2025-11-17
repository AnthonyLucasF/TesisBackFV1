// src/index.js
import app from './app.js';
import { PORT } from './config.js'; // Asegúrate que PORT sea 3000
import http from 'http';

import { Server } from 'socket.io';
import { setupWebSocket } from "./ws/websocket.js";

const server = http.createServer(app); // Crear servidor HTTP desde app.js

// Crear instancia de WebSocket y vincularla al servidor
const io = new Server(server, {
  cors: {
    origin: "*" // O especifica tu frontend: http://localhost:8100
  }
});

global._io = io; // Hacerlo accesible globalmente si lo usas en controladores

setupWebSocket(io); // Configurar los eventos personalizados

// Conexión básica
io.on("connection", (socket) => {
  console.log("🟢 Cliente WebSocket conectado");

  socket.on("disconnect", () => {
    console.log("🔴 Cliente WebSocket desconectado");
  });
});

// ✅ Solo una vez se debe llamar a listen
server.listen(PORT, () => {
  console.log(`✅ Servidor (API + WebSocket) escuchando en puerto ${PORT} :D`);
});
