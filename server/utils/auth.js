import crypto from 'node:crypto';
import { SECURITY_CONFIG } from '../config/security.js';

const DEV_FALLBACK_SECRET = crypto.createHash('sha256').update(process.cwd() + '-route3d-dev').digest('hex');
const getSecret = () => SECURITY_CONFIG.jwtSecret || DEV_FALLBACK_SECRET;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derived = crypto.scryptSync(String(password), salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function base64UrlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

export function signToken(payload, expiresInSeconds = SECURITY_CONFIG.jwtExpiresInSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = { ...payload, exp };

  const unsigned = `${base64UrlEncode(header)}.${base64UrlEncode(body)}`;
  const signature = crypto.createHmac('sha256', getSecret()).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, bodyB64, signature] = parts;
  const unsigned = `${headerB64}.${bodyB64}`;
  const expectedSig = crypto.createHmac('sha256', getSecret()).update(unsigned).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf-8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function sanitizeUser(userDoc) {
  if (!userDoc) return null;
  const u = userDoc.toObject ? userDoc.toObject() : userDoc;
  return {
    _id: u._id,
    name: u.name,
    email: u.email,
    bio: u.bio || '',
    location: u.location || '',
    primarySport: u.primarySport || 'Ride',
    weightKg: u.weightKg ?? null,
    ftpWatts: u.ftpWatts ?? null,
    maxHeartrate: u.maxHeartrate ?? null,
    restingHeartrate: u.restingHeartrate ?? null,
    hasGarminApiKey: Boolean(u.garminApiKeyHash),
    garminApiKeyPrefix: u.garminApiKeyPrefix || '',
    createdAt: u.createdAt
  };
}

export function generateGarminApiKey() {
  const raw = `r3d_${crypto.randomBytes(24).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = `${raw.slice(0, 10)}…${raw.slice(-4)}`;
  return { raw, hash, prefix };
}

export function hashGarminApiKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey || '').trim()).digest('hex');
}
