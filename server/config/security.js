import dotenv from 'dotenv';

dotenv.config();

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseIntSafe(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parsePrivacyMode(value, defaultValue = 'private') {
  const normalized = String(value || defaultValue).trim().toLowerCase();
  return normalized === 'shared' ? 'shared' : 'private';
}

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

/**
 * Configuración paramétrica de seguridad y privacidad de datos.
 * Todos los parámetros se controlan desde variables de entorno (.env)
 * con valores por defecto estrictos orientados a PRODUCCIÓN.
 */
export const SECURITY_CONFIG = Object.freeze({
  env: isProduction ? 'production' : process.env.NODE_ENV || 'development',
  isProduction,

  // Control de acceso y cuentas (Por defecto: SOLO LOGIN, sin registro público ni demo)
  allowPublicRegistration: parseBool(process.env.ALLOW_PUBLIC_REGISTRATION, false),
  enableDemoLogin: parseBool(process.env.ENABLE_DEMO_LOGIN, false),
  enableAutoSeed: parseBool(process.env.ENABLE_AUTO_SEED, false),
  allowReseedEndpoint: parseBool(process.env.ALLOW_RESEED_ENDPOINT, false),

  // Parámetros de privacidad de datos por recurso ('private' = estrictamente del usuario autenticado)
  dataPrivacy: Object.freeze({
    routes: parsePrivacyMode(process.env.DATA_PRIVACY_ROUTES, 'private'),
    plannedRoutes: parsePrivacyMode(process.env.DATA_PRIVACY_PLANNED_ROUTES, 'private'),
    segments: parsePrivacyMode(process.env.DATA_PRIVACY_SEGMENTS, 'private'),
    heatmap: parsePrivacyMode(process.env.DATA_PRIVACY_HEATMAP, 'private'),
    waterSources: parsePrivacyMode(process.env.DATA_PRIVACY_WATER_SOURCES, 'private'),
    profile: 'self-only'
  }),

  // Sesiones JWT y contraseñas
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresInSeconds: parseIntSafe(process.env.JWT_EXPIRES_IN_SECONDS, 60 * 60 * 24 * 7), // 7 días
  minPasswordLength: parseIntSafe(process.env.MIN_PASSWORD_LENGTH, 8),

  // Red, CORS y límites de peticiones (anti fuerza bruta / abuso)
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  rateLimitWindowMs: parseIntSafe(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMaxRequests: parseIntSafe(process.env.RATE_LIMIT_MAX_REQUESTS, 300),
  authRateLimitMaxAttempts: parseIntSafe(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS, 15)
});

/**
 * Devuelve un filtro MongoDB paramétrico según la política de privacidad del recurso.
 */
export function buildOwnershipFilter(resourceKey, userId, ownerField = 'userId') {
  const mode = SECURITY_CONFIG.dataPrivacy[resourceKey] || 'private';
  if (mode === 'private') {
    return { [ownerField]: userId };
  }
  return {};
}

/**
 * Valida la configuración de seguridad al arrancar el servidor.
 */
export function assertValidSecurityConfig() {
  if (!SECURITY_CONFIG.jwtSecret) {
    if (SECURITY_CONFIG.isProduction) {
      throw new Error('FATAL: JWT_SECRET es obligatorio en producción (NODE_ENV=production).');
    }
    console.warn('⚠️ AVISO: JWT_SECRET no definido en .env. Configura un secreto fuerte antes de desplegar a PRO.');
  } else if (SECURITY_CONFIG.isProduction && SECURITY_CONFIG.jwtSecret.length < 24) {
    throw new Error('FATAL: JWT_SECRET en producción debe tener al menos 24 caracteres aleatorios.');
  }
}

/**
 * Política pública segura que el frontend puede consultar para adaptar la interfaz.
 */
export function getPublicSecurityPolicy() {
  return {
    allowPublicRegistration: SECURITY_CONFIG.allowPublicRegistration,
    enableDemoLogin: SECURITY_CONFIG.enableDemoLogin,
    privateRoutesOnly: SECURITY_CONFIG.dataPrivacy.routes === 'private',
    privateSegmentsOnly: SECURITY_CONFIG.dataPrivacy.segments === 'private',
    privateHeatmapOnly: SECURITY_CONFIG.dataPrivacy.heatmap === 'private',
    privateWaterSourcesOnly: SECURITY_CONFIG.dataPrivacy.waterSources === 'private',
    profileVisibility: SECURITY_CONFIG.dataPrivacy.profile
  };
}
