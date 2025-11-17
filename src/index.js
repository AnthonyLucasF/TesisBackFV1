import app from './app.js';
import { PORT } from './config.js'; // PORT 3000
import http from 'http';

import { Server } from 'socket.io';
import { setupWebSocket } from "./ws/websocket.js";

const server = http.createServer(app); // Crear servidor HTTP desde app.js

// Crear instancia de WebSocket y vincularla al servidor con CORS reforzado y reconexión.
const io = new Server(server, {
  cors: {
    origin: "*", // Permitir todos (cambiar a específicos en prod).
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  pingTimeout: 60000, // Aumentar timeout para evitar 503 en Render.
  transports: ['websocket', 'polling'] // Priorizar WebSockets, fallback polling.
});

global._io = io; // Hacerlo accesible globalmente si lo usas en controladores

setupWebSocket(io); // Configurar los eventos personalizados

// Conexión básica con manejo de errores.
io.on("connection", (socket) => {
  console.log("🟢 Cliente WebSocket conectado");

  socket.on("disconnect", (reason) => {
    console.log(`🔴 Cliente WebSocket desconectado: ${reason}`);
  });

  socket.on("error", (error) => {
    console.error(`Error en Socket: ${error.message}`);
  });
});

// ✅ Solo una vez se debe llamar a listen. Usar process.env.PORT para Render.
server.listen(PORT, () => {
  console.log(`✅ Servidor (API + WebSocket) escuchando en puerto ${PORT} :D`);
});

// Agregamos manejo de errores en Socket.IO, aumentamos pingTimeout para evitar desconexiones en Render (causa común de 503). Reforzamos CORS en IO para coincidir con app.js. Esto debería resolver el polling fallido y CORS bloqueado.