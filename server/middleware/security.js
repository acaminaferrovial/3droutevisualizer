import { SECURITY_CONFIG } from '../config/security.js';

/**
 * Cabeceras HTTP de seguridad recomendadas para producción (sin dependencias externas)
 */
export function securityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('X-XSS-Protection', '0');

  if (SECURITY_CONFIG.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Evitar cacheo en proxies/navegadores de respuestas privadas de la API
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}

/**
 * Limitador de peticiones en memoria por IP (anti fuerza bruta en login y protección general API)
 */
export function createRateLimiter({ windowMs, maxRequests, message }) {
  const buckets = new Map();

  // Limpieza periódica para evitar crecimiento indefinido de memoria
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets.entries()) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, Math.min(windowMs, 5 * 60 * 1000));
  if (cleanupTimer.unref) cleanupTimer.unref();

  return (req, res, next) => {
    const ip =
      (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : null) ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    let entry = buckets.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      buckets.set(ip, entry);
    } else {
      entry.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));

    if (entry.count > maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      return res.status(429).json({
        success: false,
        error: message || 'Demasiadas peticiones. Inténtalo de nuevo más tarde.'
      });
    }

    next();
  };
}

/**
 * Escapa caracteres especiales de expresiones regulares para evitar ataques ReDoS en búsquedas
 */
export function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
