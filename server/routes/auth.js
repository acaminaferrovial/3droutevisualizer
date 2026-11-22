import express from 'express';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import Gear from '../models/Gear.js';
import { hashPassword, verifyPassword, signToken, sanitizeUser, generateGarminApiKey } from '../utils/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { SECURITY_CONFIG, getPublicSecurityPolicy } from '../config/security.js';
import { createRateLimiter } from '../middleware/security.js';

const router = express.Router();

const authBruteForceLimiter = createRateLimiter({
  windowMs: SECURITY_CONFIG.rateLimitWindowMs,
  maxRequests: SECURITY_CONFIG.authRateLimitMaxAttempts,
  message: 'Demasiados intentos de acceso. Espera unos minutos antes de volver a intentarlo.'
});

/**
 * GET /api/auth/policy
 * Devuelve los parámetros públicos de seguridad para adaptar la interfaz
 */
router.get('/policy', (req, res) => {
  res.json({
    success: true,
    policy: getPublicSecurityPolicy()
  });
});

/**
 * POST /api/auth/register
 * Deshabilitado por defecto en producción (ALLOW_PUBLIC_REGISTRATION=false -> solo login)
 */
router.post('/register', authBruteForceLimiter, async (req, res) => {
  if (!SECURITY_CONFIG.allowPublicRegistration) {
    return res.status(403).json({
      success: false,
      error: 'El registro público está deshabilitado. Solicita acceso al administrador.'
    });
  }
  try {
    const {
      name,
      email,
      password,
      location = '',
      primarySport = 'Ride',
      weightKg = null,
      ftpWatts = null
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre es obligatorio' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'El email es obligatorio' });
    }
    if (!password || String(password).length < SECURITY_CONFIG.minPasswordLength) {
      return res.status(400).json({
        success: false,
        error: `La contraseña debe tener al menos ${SECURITY_CONFIG.minPasswordLength} caracteres`
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ya existe una cuenta con ese email' });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      location: location.trim(),
      primarySport,
      weightKg: weightKg !== '' && weightKg !== null ? Number(weightKg) : null,
      ftpWatts: ftpWatts !== '' && ftpWatts !== null ? Number(ftpWatts) : null
    });

    const token = signToken({ id: String(user._id), email: user.email });
    res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Inicio de sesión con email y contraseña (protegido contra fuerza bruta)
 */
router.post('/login', authBruteForceLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Introduce tu email y contraseña' });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }

    const token = signToken({ id: String(user._id), email: user.email });
    res.json({
      success: true,
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error interno al iniciar sesión' });
  }
});

/**
 * GET /api/auth/demo-users
 * Deshabilitado por defecto en PRO (ENABLE_DEMO_LOGIN=false) para no exponer usuarios ni emails
 */
router.get('/demo-users', async (req, res) => {
  if (!SECURITY_CONFIG.enableDemoLogin) {
    return res.status(403).json({ success: false, error: 'Acceso demo deshabilitado' });
  }
  try {
    const users = await User.find().select('name email location primarySport').sort({ createdAt: 1 }).lean();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Perfil del usuario actual + contadores rápidos
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [user, activitiesCount, bikesCount] = await Promise.all([
      User.findById(req.user.id),
      Activity.countDocuments({ userId: req.user._id }),
      Gear.countDocuments({ userId: req.user._id, category: 'bike' })
    ]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      user: sanitizeUser(user),
      summary: {
        activitiesCount,
        bikesCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/auth/me
 * Actualizar datos de Mi Perfil
 */
router.put('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const {
      name,
      email,
      bio,
      location,
      primarySport,
      weightKg,
      ftpWatts,
      maxHeartrate,
      restingHeartrate,
      newPassword
    } = req.body;

    if (email && email.trim().toLowerCase() !== user.email) {
      const normalized = email.trim().toLowerCase();
      const taken = await User.findOne({ email: normalized, _id: { $ne: user._id } });
      if (taken) {
        return res.status(400).json({ success: false, error: 'Ese email ya está en uso por otro usuario' });
      }
      user.email = normalized;
    }

    if (name !== undefined && name.trim()) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (location !== undefined) user.location = location.trim();
    if (primarySport !== undefined) user.primarySport = primarySport;
    if (weightKg !== undefined) user.weightKg = weightKg !== '' && weightKg !== null ? Number(weightKg) : null;
    if (ftpWatts !== undefined) user.ftpWatts = ftpWatts !== '' && ftpWatts !== null ? Number(ftpWatts) : null;
    if (maxHeartrate !== undefined) {
      user.maxHeartrate = maxHeartrate !== '' && maxHeartrate !== null ? Number(maxHeartrate) : null;
    }
    if (restingHeartrate !== undefined) {
      user.restingHeartrate = restingHeartrate !== '' && restingHeartrate !== null ? Number(restingHeartrate) : null;
    }
    if (newPassword !== undefined && String(newPassword).trim().length > 0) {
      if (String(newPassword).trim().length < SECURITY_CONFIG.minPasswordLength) {
        return res.status(400).json({
          success: false,
          error: `La nueva contraseña debe tener al menos ${SECURITY_CONFIG.minPasswordLength} caracteres`
        });
      }
      user.passwordHash = hashPassword(String(newPassword).trim());
    }

    await user.save();

    res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/garmin-key
 * Genera o rota la clave API personal para conectar el Garmin Edge 1040 (solo visible una vez)
 */
router.post('/garmin-key', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const { raw, hash, prefix } = generateGarminApiKey();
    user.garminApiKeyHash = hash;
    user.garminApiKeyPrefix = prefix;
    await user.save();

    res.json({
      success: true,
      apiKey: raw,
      prefix,
      user: sanitizeUser(user)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/auth/garmin-key
 * Revoca la clave API del Garmin Edge 1040
 */
router.delete('/garmin-key', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    user.garminApiKeyHash = null;
    user.garminApiKeyPrefix = '';
    await user.save();

    res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
