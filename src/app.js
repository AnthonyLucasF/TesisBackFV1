import express from 'express';
import jwt from 'jsonwebtoken';

import loginRoutes from './routes/login.routes.js';

import choferRoutes from './routes/chofer.routes.js';
import claseRoutes from './routes/clase.routes.js';
import cocheRoutes from './routes/coche.routes.js';
import colorRoutes from './routes/color.routes.js';
import control_calidadRoutes from './routes/control_calidad.routes.js';
import corteRoutes from './routes/corte.routes.js';
import defectosRoutes from './routes/defectos.routes.js';
import glaseoRoutes from './routes/glaseo.routes.js';
import grupoRoutes from './routes/grupo.routes.js';
import ingresotunelRoutes from './routes/ingresotunel.routes.js';
import loteRoutes from './routes/lote.routes.js';
import liquidacionRoutes from './routes/liquidacion.routes.js';
import maquinaRoutes from './routes/maquina.routes.js';
import masterizadoRoutes from './routes/masterizado.routes.js';
import ordenRoutes from './routes/orden.routes.js';
import pesoRoutes from './routes/peso.routes.js';
import presentacionRoutes from './routes/presentacion.routes.js';
import proveedorRoutes from './routes/proveedor.routes.js';
import tallaRoutes from './routes/talla.routes.js';
import tipoRoutes from './routes/tipo.routes.js';
import usuarioRoutes from './routes/usuarios.routes.js';
import vehiculoRoutes from './routes/vehiculo.routes.js';
import descabezadoRoutes from './routes/descabezado.routes.js'; // Nueva
import peladoRoutes from './routes/pelado.routes.js'; // Nueva

import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';

import { config } from 'dotenv';

config();

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS reforzado: Permitir orígenes específicos o '*' para testing. Agregar credentials y preflight para OPTIONS.
const corsOptions = {
  origin: '*', // Cambiar a ['http://localhost:8100', 'https://tu-frontend.com'] en prod para seguridad.
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Si usas cookies/JWT con credentials.
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Manejo manual de preflight OPTIONS para CORS (necesario en Render si cors package falla).
app.options('*', cors(corsOptions));

app.use('/api', loginRoutes);
app.use('/api', choferRoutes);
app.use('/api', claseRoutes);
app.use('/api', cocheRoutes);
app.use('/api', colorRoutes);
app.use('/api', control_calidadRoutes);
app.use('/api', corteRoutes);
app.use('/api', defectosRoutes);
app.use('/api', glaseoRoutes);
app.use('/api', grupoRoutes);
app.use('/api', ingresotunelRoutes);
app.use('/api', loteRoutes);
app.use('/api', liquidacionRoutes);
app.use('/api', maquinaRoutes);
app.use('/api', masterizadoRoutes);
app.use('/api', ordenRoutes);
app.use('/api', pesoRoutes);
app.use('/api', presentacionRoutes);
app.use('/api', proveedorRoutes);
app.use('/api', tallaRoutes);
app.use('/api', tipoRoutes);
app.use('/api', usuarioRoutes);
app.use('/api', vehiculoRoutes);
app.use('/api', descabezadoRoutes); // Nueva ruta
app.use('/api', peladoRoutes); // Nueva ruta

app.get("/api", (req, res) => {
    res.json({
        mensaje: "API RESTful de mi Tesis :D"
    });
});

// Manejo de rutas no encontradas
app.use((req, res, next) => {
    res.status(400).json({
        message: 'Ruta no encontrada :('
    });
});

// Iniciar servidor usando process.env.PORT para Render (dinámico, no hardcode 3000).
const PORT = process.env.PORT || 3000; // Render asigna PORT automáticamente.

export default app; // Exportar para uso en index.js

// Refuerzo de CORS con options explícitas y manejo de preflight. Usamos process.env.PORT para compatibilidad con Render (evita 503 por puerto mal configurado). Agregamos logs para depuración en consola de Render.