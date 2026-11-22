import { verifyToken } from '../utils/auth.js';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ success: false, error: 'No autenticado. Inicia sesión.' });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.id) {
      return res.status(401).json({ success: false, error: 'Sesión inválida o expirada.' });
    }

    const user = await User.findById(payload.id).lean();
    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuario no encontrado.' });
    }

    req.user = {
      id: String(user._id),
      _id: user._id,
      email: user.email,
      name: user.name
    };
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Error de autenticación.' });
  }
}
