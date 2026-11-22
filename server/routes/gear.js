import express from 'express';
import Gear from '../models/Gear.js';
import Activity from '../models/Activity.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

function parseOptionalNumber(val) {
  if (val === '' || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

/**
 * GET /api/gear
 * Lista todos los equipos del usuario autenticado con estadísticas acumuladas y revisiones ordenadas
 */
router.get('/', async (req, res) => {
  try {
    const userFilter = { userId: req.user._id };
    const [gearList, activities] = await Promise.all([
      Gear.find(userFilter).sort({ retired: 1, isDefault: -1, createdAt: -1 }).lean(),
      Activity.find(userFilter).select('gear gearId distance movingTime totalElevationGain startDate type').lean()
    ]);

    const enriched = gearList.map((g) => {
      const matched = activities.filter(
        (a) =>
          (a.gearId && String(a.gearId) === String(g._id)) ||
          (a.gear && a.gear.trim().toLowerCase() === g.name.trim().toLowerCase())
      );

      const loggedMeters = matched.reduce((acc, a) => acc + (a.distance || 0), 0);
      const loggedSeconds = matched.reduce((acc, a) => acc + (a.movingTime || 0), 0);
      const loggedElevation = matched.reduce((acc, a) => acc + (a.totalElevationGain || 0), 0);

      const loggedDistanceKm = Number((loggedMeters / 1000).toFixed(1));
      const totalDistanceKm = Number(((g.initialDistanceKm || 0) + loggedMeters / 1000).toFixed(1));
      const totalMovingHours = Number((loggedSeconds / 3600).toFixed(1));

      const logs = [...(g.maintenanceLogs || [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const lastMaintenance = logs[0] || null;
      const kmSinceLastService = lastMaintenance
        ? Math.max(0, Number((totalDistanceKm - (lastMaintenance.odometerKm || 0)).toFixed(1)))
        : totalDistanceKm;

      return {
        ...g,
        maintenanceLogs: logs,
        stats: {
          activitiesCount: matched.length,
          loggedDistanceKm,
          totalDistanceKm,
          totalElevationGain: Math.round(loggedElevation),
          totalMovingHours,
          kmSinceLastService
        }
      };
    });

    res.json({ success: true, gear: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/gear
 * Crear una nueva bicicleta o equipo
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      category = 'bike',
      bikeType = 'Road',
      brand = '',
      model = '',
      weightKg = null,
      initialDistanceKm = 0,
      maxDistanceKm = null,
      notes = '',
      isDefault = false,
      suspension = {}
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre del equipo es obligatorio' });
    }

    if (isDefault) {
      await Gear.updateMany({ userId: req.user._id, category }, { $set: { isDefault: false } });
    }

    const gear = await Gear.create({
      userId: req.user._id,
      name: name.trim(),
      category,
      bikeType: category === 'bike' ? bikeType : '',
      brand: brand.trim(),
      model: model.trim(),
      weightKg: parseOptionalNumber(weightKg),
      initialDistanceKm: Number(initialDistanceKm) || 0,
      maxDistanceKm: parseOptionalNumber(maxDistanceKm),
      notes: notes.trim(),
      isDefault: Boolean(isDefault),
      suspension: {
        forkModel: (suspension.forkModel || '').trim(),
        forkSag: parseOptionalNumber(suspension.forkSag),
        forkPsi: parseOptionalNumber(suspension.forkPsi),
        forkRebound: (suspension.forkRebound || '').trim(),
        shockModel: (suspension.shockModel || '').trim(),
        shockSag: parseOptionalNumber(suspension.shockSag),
        shockPsi: parseOptionalNumber(suspension.shockPsi),
        shockRebound: (suspension.shockRebound || '').trim()
      }
    });

    res.status(201).json({ success: true, gear });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/gear/:id
 * Actualizar bicicleta o equipo (incluyendo SAG y suspensiones)
 */
router.put('/:id', async (req, res) => {
  try {
    const existing = await Gear.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Equipo no encontrado' });
    }

    const {
      name,
      category,
      bikeType,
      brand,
      model,
      weightKg,
      initialDistanceKm,
      maxDistanceKm,
      notes,
      isDefault,
      retired,
      suspension
    } = req.body;

    const targetCategory = category || existing.category;
    if (isDefault) {
      await Gear.updateMany(
        { userId: req.user._id, category: targetCategory, _id: { $ne: existing._id } },
        { $set: { isDefault: false } }
      );
    }

    const previousName = existing.name;
    if (name !== undefined) existing.name = name.trim();
    if (category !== undefined) existing.category = category;
    if (bikeType !== undefined) existing.bikeType = existing.category === 'bike' ? bikeType : '';
    if (brand !== undefined) existing.brand = brand.trim();
    if (model !== undefined) existing.model = model.trim();
    if (weightKg !== undefined) existing.weightKg = parseOptionalNumber(weightKg);
    if (initialDistanceKm !== undefined) existing.initialDistanceKm = Number(initialDistanceKm) || 0;
    if (maxDistanceKm !== undefined) existing.maxDistanceKm = parseOptionalNumber(maxDistanceKm);
    if (notes !== undefined) existing.notes = notes.trim();
    if (isDefault !== undefined) existing.isDefault = Boolean(isDefault);
    if (retired !== undefined) existing.retired = Boolean(retired);

    if (suspension !== undefined) {
      existing.suspension = {
        forkModel: (suspension.forkModel ?? existing.suspension?.forkModel ?? '').trim(),
        forkSag:
          suspension.forkSag !== undefined ? parseOptionalNumber(suspension.forkSag) : existing.suspension?.forkSag,
        forkPsi:
          suspension.forkPsi !== undefined ? parseOptionalNumber(suspension.forkPsi) : existing.suspension?.forkPsi,
        forkRebound: (suspension.forkRebound ?? existing.suspension?.forkRebound ?? '').trim(),
        shockModel: (suspension.shockModel ?? existing.suspension?.shockModel ?? '').trim(),
        shockSag:
          suspension.shockSag !== undefined ? parseOptionalNumber(suspension.shockSag) : existing.suspension?.shockSag,
        shockPsi:
          suspension.shockPsi !== undefined ? parseOptionalNumber(suspension.shockPsi) : existing.suspension?.shockPsi,
        shockRebound: (suspension.shockRebound ?? existing.suspension?.shockRebound ?? '').trim()
      };
    }

    await existing.save();

    if (name && previousName !== existing.name) {
      await Activity.updateMany(
        {
          userId: req.user._id,
          $or: [{ gearId: existing._id }, { gear: previousName }]
        },
        {
          $set: { gear: existing.name, gearId: existing._id }
        }
      );
    }

    res.json({ success: true, gear: existing });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/gear/:id/maintenance
 * Registrar una nueva revisión o modificación en la bicicleta
 */
router.post('/:id/maintenance', async (req, res) => {
  try {
    const gear = await Gear.findOne({ _id: req.params.id, userId: req.user._id });
    if (!gear) {
      return res.status(404).json({ success: false, error: 'Bicicleta / equipo no encontrado' });
    }

    const { date, odometerKm, type = 'general', title, details = '', forkSag, forkPsi, shockSag, shockPsi, cost } =
      req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Indica qué se ha revisado o modificado' });
    }

    const newLog = {
      date: date ? new Date(date) : new Date(),
      odometerKm: Number(odometerKm) || 0,
      type,
      title: title.trim(),
      details: details.trim(),
      forkSag: parseOptionalNumber(forkSag),
      forkPsi: parseOptionalNumber(forkPsi),
      shockSag: parseOptionalNumber(shockSag),
      shockPsi: parseOptionalNumber(shockPsi),
      cost: parseOptionalNumber(cost)
    };

    gear.maintenanceLogs.push(newLog);

    // Si en la revisión se ajustó el SAG o presión, actualizamos la configuración activa de la bici
    if (!gear.suspension) gear.suspension = {};
    if (newLog.forkSag !== null) gear.suspension.forkSag = newLog.forkSag;
    if (newLog.forkPsi !== null) gear.suspension.forkPsi = newLog.forkPsi;
    if (newLog.shockSag !== null) gear.suspension.shockSag = newLog.shockSag;
    if (newLog.shockPsi !== null) gear.suspension.shockPsi = newLog.shockPsi;

    await gear.save();
    res.status(201).json({ success: true, gear });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/gear/:id/maintenance/:logId
 * Eliminar una entrada del historial de revisiones
 */
router.delete('/:id/maintenance/:logId', async (req, res) => {
  try {
    const gear = await Gear.findOne({ _id: req.params.id, userId: req.user._id });
    if (!gear) {
      return res.status(404).json({ success: false, error: 'Equipo no encontrado' });
    }

    gear.maintenanceLogs = (gear.maintenanceLogs || []).filter((l) => String(l._id) !== String(req.params.logId));
    await gear.save();
    res.json({ success: true, gear });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/gear/:id
 * Eliminar bicicleta o equipo
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Gear.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Equipo no encontrado' });
    }
    await Activity.updateMany({ userId: req.user._id, gearId: deleted._id }, { $set: { gearId: null } });
    res.json({ success: true, message: 'Equipo eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
