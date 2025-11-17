// src/ws/websocket.js
console.log("Base de Datos en la nube Clever Cloud :)");

export const setupWebSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Cliente WebSocket conectado");

    // Eventos para Módulo 4
    socket.on("ingreso_tunel_nuevo", (data) => {
      console.log("📦 Nuevo ingreso de túnel:", data);
      socket.broadcast.emit("ingreso_tunel_nuevo", data);
    });

    socket.on("ingreso_tunel_actualizado", (data) => {
      console.log("✏️ Ingreso de túnel actualizado:", data);
      socket.broadcast.emit("ingreso_tunel_actualizado", data);
    });

    socket.on("ingreso_tunel_eliminado", (data) => {
      console.log("🗑️ Ingreso de túnel eliminado:", data);
      socket.broadcast.emit("ingreso_tunel_eliminado", data);
    });

    socket.on("orden_actualizada", (data) => {
      console.log("🔄 Orden actualizada:", data);
      socket.broadcast.emit("orden_actualizada", data);
    });

    socket.on("orden_cumplida", (data) => {
      console.log("✅ Orden cumplida:", data);
      socket.broadcast.emit("orden_cumplida", data);
    });

    socket.on("liquidacion_generada", (data) => {
      console.log("📄 Liquidación generada:", data);
      socket.broadcast.emit("liquidacion_generada", data);
    });

    socket.on("liquidacion_actualizada", (data) => {
      console.log("✏️ Liquidación actualizada:", data);
      socket.broadcast.emit("liquidacion_actualizada", data);
    });

    socket.on("liquidacion_eliminada", (data) => {
      console.log("🗑️ Liquidación eliminada:", data);
      socket.broadcast.emit("liquidacion_eliminada", data);
    });

    socket.on("descabezado_nuevo", (data) => {
      console.log("📦 Nuevo descabezado:", data);
      socket.broadcast.emit("descabezado_nuevo", data);
    });

    socket.on("descabezado_actualizado", (data) => {
      console.log("✏️ Descabezado actualizado:", data);
      socket.broadcast.emit("descabezado_actualizado", data);
    });

    socket.on("descabezado_eliminado", (data) => {
      console.log("🗑️ Descabezado eliminado:", data);
      socket.broadcast.emit("descabezado_eliminado", data);
    });

    socket.on("pelado_nuevo", (data) => {
      console.log("📦 Nuevo pelado:", data);
      socket.broadcast.emit("pelado_nuevo", data);
    });

    socket.on("pelado_actualizado", (data) => {
      console.log("✏️ Pelado actualizado:", data);
      socket.broadcast.emit("pelado_actualizado", data);
    });

    socket.on("pelado_eliminado", (data) => {
      console.log("🗑️ Pelado eliminado:", data);
      socket.broadcast.emit("pelado_eliminado", data);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Cliente WebSocket desconectado");
    });
  });
};