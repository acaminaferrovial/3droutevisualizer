import express from 'express';
import multer from 'multer';
import Activity from '../models/Activity.js';
import Gear from '../models/Gear.js';
import { parseGPX } from '../utils/gpxParser.js';
import { seedInitialActivities } from '../utils/seedData.js';
import { requireAuth } from '../middleware/auth.js';
import { SECURITY_CONFIG, buildOwnershipFilter } from '../config/security.js';
import { escapeRegex } from '../middleware/security.js';

const router = express.Router();
const ALLOWED_SORT_FIELDS = new Set(['startDate', 'movingTime', 'distance', 'totalElevationGain', 'averageSpeed', 'createdAt']);

// Todas las rutas de actividades son multi-usuario y requieren autenticación
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

/**
 * GET /api/activities
 * Lista de actividades del usuario autenticado con filtros y ordenación
 */
router.get('/', async (req, res) => {
  try {
    const {
      type,
      gear,
      gearId,
      dateFrom,
      dateTo,
      search,
      sortBy = 'startDate',
      sortOrder = 'desc',
      limit = 50,
      page = 1
    } = req.query;

    const filter = { ...buildOwnershipFilter('routes', req.user._id, 'userId') };
    if (type && type !== 'all') {
      filter.type = type;
    }
    if (gearId && gearId !== 'all') {
      const gearDoc = await Gear.findOne({ _id: gearId, userId: req.user._id }).lean().catch(() => null);
      if (gearDoc) {
        filter.$or = [{ gearId: gearDoc._id }, { gear: gearDoc.name }];
      } else {
        filter.gearId = gearId;
      }
    } else if (gear && gear !== 'all') {
      filter.gear = gear;
    }
    if (dateFrom || dateTo) {
      filter.startDate = {};
      if (dateFrom) {
        filter.startDate.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        filter.startDate.$lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
    }
    if (search) {
      filter.title = { $regex: escapeRegex(search), $options: 'i' };
    }

    const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'startDate';
    const sort = {};
    sort[safeSortBy] = sortOrder === 'asc' ? 1 : -1;

    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (safePage - 1) * safeLimit;

    const activities = await Activity.find(filter)
      .select('-geojson.features.geometry.coordinates')
      .sort(sort)
      .skip(skip)
      .limit(safeLimit);

    const total = await Activity.countDocuments(filter);

    res.json({
      success: true,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
      activities
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/activities/heatmap/tracks
 * Devuelve las trazas para pintar el Mapa de Calor respetando el parámetro DATA_PRIVACY_HEATMAP (por defecto: privadas)
 */
router.get('/heatmap/tracks', async (req, res) => {
  try {
    const heatmapFilter = buildOwnershipFilter('heatmap', req.user._id, 'userId');
    const activities = await Activity.find(heatmapFilter).select('title type geojson').limit(200).lean();
    const features = [];

    for (const act of activities) {
      const feat = act.geojson?.features?.find(
        (f) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
      );
      if (feat && feat.geometry?.coordinates?.length >= 2) {
        features.push({
          type: 'Feature',
          properties: {
            title: act.title,
            sportType: act.type || 'Ride'
          },
          geometry: {
            type: feat.geometry.type,
            coordinates: feat.geometry.coordinates
          }
        });
      }
    }

    res.json({
      success: true,
      geojson: {
        type: 'FeatureCollection',
        features
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/activities/stats/summary
 * Estadísticas globales del usuario autenticado y récords personales
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const activities = await Activity.find({ userId: req.user._id }).select(
      'distance movingTime totalElevationGain type calories startDate splits maxSpeed'
    );

    let totalDistance = 0;
    let totalMovingTime = 0;
    let totalElevationGain = 0;
    let totalCalories = 0;
    let longestDistance = 0;
    let highestClimb = 0;
    let fastestSpeed = 0;

    const bySport = {};

    activities.forEach((act) => {
      totalDistance += act.distance || 0;
      totalMovingTime += act.movingTime || 0;
      totalElevationGain += act.totalElevationGain || 0;
      totalCalories += act.calories || 0;

      longestDistance = Math.max(longestDistance, act.distance || 0);
      highestClimb = Math.max(highestClimb, act.totalElevationGain || 0);
      fastestSpeed = Math.max(fastestSpeed, act.maxSpeed || 0);

      const sport = act.type || 'Other';
      if (!bySport[sport]) {
        bySport[sport] = { count: 0, distance: 0, time: 0, elevation: 0 };
      }
      bySport[sport].count++;
      bySport[sport].distance += act.distance || 0;
      bySport[sport].time += act.movingTime || 0;
      bySport[sport].elevation += act.totalElevationGain || 0;
    });

    res.json({
      success: true,
      stats: {
        totalActivities: activities.length,
        totalDistanceKm: Number((totalDistance / 1000).toFixed(1)),
        totalMovingHours: Number((totalMovingTime / 3600).toFixed(1)),
        totalElevationGain: Math.round(totalElevationGain),
        totalCalories: Math.round(totalCalories),
        records: {
          longestDistanceKm: Number((longestDistance / 1000).toFixed(2)),
          highestClimbMeters: Math.round(highestClimb),
          maxSpeedKmh: Number(fastestSpeed.toFixed(1))
        },
        bySport
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/activities/:id
 * Detalle completo de una actividad del usuario autenticado
 */
router.get('/:id', async (req, res) => {
  try {
    const activity = await Activity.findOne({ _id: req.params.id, userId: req.user._id });
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }
    res.json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/activities/upload-gpx
 * Subida y parseo automático de archivo GPX para el usuario autenticado
 */
router.post('/upload-gpx', upload.single('gpxFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se ha adjuntado ningún archivo GPX' });
    }

    const gpxString = req.file.buffer.toString('utf-8');
    const parsedData = parseGPX(gpxString, {
      title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
      type: req.body.type
    });

    parsedData.userId = req.user._id;
    if (req.body.description) parsedData.description = req.body.description;
    if (req.body.gearId) {
      const gearDoc = await Gear.findOne({ _id: req.body.gearId, userId: req.user._id }).lean().catch(() => null);
      if (gearDoc) {
        parsedData.gearId = gearDoc._id;
        parsedData.gear = gearDoc.name;
      }
    } else if (req.body.gear) {
      parsedData.gear = req.body.gear;
    }
    if (req.body.perceivedExertion) parsedData.perceivedExertion = Number(req.body.perceivedExertion);

    const activity = new Activity(parsedData);
    await activity.save();

    res.status(201).json({
      success: true,
      message: 'Ruta GPX guardada con éxito',
      activity
    });
  } catch (err) {
    console.error('Error procesando GPX:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/activities
 */
router.post('/', async (req, res) => {
  try {
    const {
      title,
      type = 'Ride',
      description = '',
      startDate,
      distance,
      movingTime,
      elapsedTime,
      totalElevationGain,
      totalElevationLoss,
      averageSpeed,
      maxSpeed,
      averageHeartrate,
      maxHeartrate,
      averageWatts,
      averageCadence,
      calories,
      gear,
      gearId,
      perceivedExertion,
      geojson,
      splits,
      elevationProfile,
      bounds
    } = req.body;

    let resolvedGearId = null;
    let resolvedGearName = gear || '';
    if (gearId) {
      const gearDoc = await Gear.findOne({ _id: gearId, userId: req.user._id }).lean().catch(() => null);
      if (gearDoc) {
        resolvedGearId = gearDoc._id;
        resolvedGearName = gearDoc.name;
      }
    }

    const activity = new Activity({
      userId: req.user._id,
      title,
      type,
      description,
      startDate,
      distance,
      movingTime,
      elapsedTime,
      totalElevationGain,
      totalElevationLoss,
      averageSpeed,
      maxSpeed,
      averageHeartrate,
      maxHeartrate,
      averageWatts,
      averageCadence,
      calories,
      gear: resolvedGearName,
      gearId: resolvedGearId,
      perceivedExertion,
      geojson,
      splits,
      elevationProfile,
      bounds
    });
    await activity.save();
    res.status(201).json({ success: true, activity });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/activities/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { title, description, type, perceivedExertion, gear, gearId } = req.body;
    const updateFields = { title, description, type, perceivedExertion };

    if (gearId) {
      const gearDoc = await Gear.findOne({ _id: gearId, userId: req.user._id }).lean().catch(() => null);
      if (gearDoc) {
        updateFields.gearId = gearDoc._id;
        updateFields.gear = gearDoc.name;
      }
    } else if (gear !== undefined) {
      updateFields.gear = gear;
      updateFields.gearId = null;
    }

    const activity = await Activity.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }
    res.json({ success: true, activity });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/activities/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const activity = await Activity.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }
    res.json({ success: true, message: 'Actividad eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/activities/reseed
 * Deshabilitado por defecto en producción (ALLOW_RESEED_ENDPOINT=false)
 */
router.post('/reseed', async (req, res) => {
  if (!SECURITY_CONFIG.allowReseedEndpoint) {
    return res.status(403).json({ success: false, error: 'Reseed deshabilitado en este entorno' });
  }
  try {
    await seedInitialActivities(req.user._id);
    res.json({ success: true, message: 'Datos de prueba sembrados' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
