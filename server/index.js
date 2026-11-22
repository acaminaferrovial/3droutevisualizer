import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import activitiesRouter from './routes/activities.js';
import gearRouter from './routes/gear.js';
import authRouter from './routes/auth.js';
import segmentsRouter from './routes/segments.js';
import plannedRoutesRouter from './routes/plannedRoutes.js';
import waterSourcesRouter from './routes/waterSources.js';
import garminRouter from './routes/garmin.js';
import { SECURITY_CONFIG, assertValidSecurityConfig } from './config/security.js';
import { securityHeaders, createRateLimiter } from './middleware/security.js';
import { seedInitialActivities } from './utils/seedData.js';

// Cargar variables de entorno
dotenv.config();
assertValidSecurityConfig();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI no está definido en el archivo .env');
  process.exit(1);
}

// Middlewares de seguridad, CORS paramétrico y rate limiting
app.use(securityHeaders);
app.use(
  cors({
    origin(origin, callback) {
      // Permitir peticiones same-origin o sin cabecera Origin (ej: proxy Vite / healthcheck interno)
      if (!origin || SECURITY_CONFIG.corsAllowedOrigins.includes('*') || SECURITY_CONFIG.corsAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true
  })
);
app.use(
  '/api',
  createRateLimiter({
    windowMs: SECURITY_CONFIG.rateLimitWindowMs,
    maxRequests: SECURITY_CONFIG.rateLimitMaxRequests,
    message: 'Has superado el límite temporal de peticiones. Espera unos minutos.'
  })
);
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Rutas de la API
app.use('/api/auth', authRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/gear', gearRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/planned-routes', plannedRoutesRouter);
app.use('/api/water-sources', waterSourcesRouter);
app.use('/api/garmin', garminRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// Servir el frontend compilado (dist/) automáticamente en producción
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Conectar a MongoDB y arrancar servidor
async function startServer() {
  try {
    console.log('Conectando a MongoDB Cluster0 (Base de datos: routevisualizer)...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conexión exitosa a MongoDB');

    // Sembrar actividades de ejemplo solo si está explícitamente habilitado por parámetro
    if (SECURITY_CONFIG.enableAutoSeed) {
      await seedInitialActivities();
    }

    app.listen(PORT, () => {
      console.log(
        `🚀 Servidor backend escuchando en http://localhost:${PORT} [entorno=${SECURITY_CONFIG.env}, registroPúblico=${SECURITY_CONFIG.allowPublicRegistration}, rutas=${SECURITY_CONFIG.dataPrivacy.routes}]`
      );
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

startServer();
