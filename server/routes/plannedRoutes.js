import express from 'express';
import PlannedRoute from '../models/PlannedRoute.js';
import Gear from '../models/Gear.js';
import { requireAuth } from '../middleware/auth.js';
import { buildOwnershipFilter } from '../config/security.js';

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/planned-routes
 * Lista las rutas planificadas del usuario autenticado (privadas por defecto)
 */
router.get('/', async (req, res) => {
  try {
    const filter = buildOwnershipFilter('plannedRoutes', req.user._id, 'userId');
    const routes = await PlannedRoute.find(filter).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, routes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/planned-routes
 * Guardar una nueva ruta diseñada en el planificador
 */
router.post('/', async (req, res) => {
  try {
    const {
      title,
      sportType = 'Ride',
      bikeId = null,
      notes = '',
      distanceMeters = 0,
      elevationGain = 0,
      elevationLoss = 0,
      estimatedTimeSeconds = 0,
      targetSpeedKmh = 25,
      plannedDate = '',
      departureTime = '09:00',
      sourceActivityId = null,
      waypoints = [],
      coordinates = [],
      elevationProfile = []
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre de la ruta es obligatorio' });
    }
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ success: false, error: 'Traza al menos 2 puntos en el mapa para guardar la ruta' });
    }

    let resolvedBikeId = null;
    let resolvedBikeName = '';
    if (bikeId) {
      const gearDoc = await Gear.findOne({ _id: bikeId, userId: req.user._id }).lean().catch(() => null);
      if (gearDoc) {
        resolvedBikeId = gearDoc._id;
        resolvedBikeName = gearDoc.name;
      }
    }

    const planned = await PlannedRoute.create({
      userId: req.user._id,
      title: title.trim(),
      sportType,
      bikeId: resolvedBikeId,
      bikeName: resolvedBikeName,
      notes: (notes || '').trim(),
      distanceMeters: Math.round(Number(distanceMeters) || 0),
      elevationGain: Math.round(Number(elevationGain) || 0),
      elevationLoss: Math.round(Number(elevationLoss) || 0),
      estimatedTimeSeconds: Math.round(Number(estimatedTimeSeconds) || 0),
      targetSpeedKmh: Number(targetSpeedKmh) || 25,
      plannedDate: plannedDate || '',
      departureTime: departureTime || '09:00',
      sourceActivityId: sourceActivityId || null,
      waypoints,
      coordinates,
      elevationProfile
    });

    res.status(201).json({ success: true, route: planned });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/planned-routes/:id
 * Eliminar una ruta planificada
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await PlannedRoute.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Ruta planificada no encontrada' });
    }
    res.json({ success: true, message: 'Ruta planificada eliminada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
