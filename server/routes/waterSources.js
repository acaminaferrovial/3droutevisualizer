import express from 'express';
import WaterSource from '../models/WaterSource.js';
import { requireAuth } from '../middleware/auth.js';
import { buildOwnershipFilter } from '../config/security.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/water-sources
 * Devuelve las fuentes de agua respetando DATA_PRIVACY_WATER_SOURCES (por defecto: solo las del usuario)
 */
router.get('/', async (req, res) => {
  try {
    const { minLng, minLat, maxLng, maxLat } = req.query;
    const filter = { ...buildOwnershipFilter('waterSources', req.user._id, 'createdBy') };
    if (minLng !== undefined && maxLng !== undefined && minLat !== undefined && maxLat !== undefined) {
      filter.lng = { $gte: Number(minLng), $lte: Number(maxLng) };
      filter.lat = { $gte: Number(minLat), $lte: Number(maxLat) };
    }
    const sources = await WaterSource.find(filter).sort({ createdAt: -1 }).limit(300).lean();
    res.json({ success: true, sources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/water-sources
 * Añadir una nueva fuente de agua potable conocida por el ciclista
 */
router.post('/', async (req, res) => {
  try {
    const { name = 'Fuente de agua potable', notes = '', lng, lat } = req.body;
    if (lng === undefined || lat === undefined) {
      return res.status(400).json({ success: false, error: 'Coordenadas de la fuente obligatorias' });
    }

    const source = await WaterSource.create({
      name: (name || 'Fuente de agua potable').trim(),
      notes: (notes || '').trim(),
      lng: Number(lng),
      lat: Number(lat),
      createdBy: req.user._id,
      creatorName: req.user.name
    });

    res.status(201).json({ success: true, source });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/water-sources/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await WaterSource.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Fuente no encontrada' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
