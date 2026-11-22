import express from 'express';
import * as turf from '@turf/turf';
import Segment from '../models/Segment.js';
import Activity from '../models/Activity.js';
import { requireAuth } from '../middleware/auth.js';
import { SECURITY_CONFIG, buildOwnershipFilter } from '../config/security.js';

const router = express.Router();

router.use(requireAuth);

/**
 * Clasifica la categoría de un puerto/segmento según distancia y pendiente media (estilo ciclismo)
 */
export function classifyClimbCategory(distanceMeters, avgGrade) {
  const score = (distanceMeters / 1000) * Math.max(0, avgGrade) * Math.max(0, avgGrade);
  if (avgGrade < 2.5 || distanceMeters < 300) return 'Llano / Sprint';
  if (score >= 600) return 'HC';
  if (score >= 300) return '1ª Cat';
  if (score >= 150) return '2ª Cat';
  if (score >= 70) return '3ª Cat';
  if (score >= 25) return '4ª Cat';
  return 'Repecho';
}

/**
 * Comprueba si una actividad pasa por las coordenadas de inicio y fin de un segmento (tolerancia ~180m)
 * y calcula el esfuerzo (tiempo y velocidad media) en ese tramo
 */
export function matchActivityToSegment(activity, startCoord, endCoord, segDistanceMeters) {
  const feature = activity?.geojson?.features?.find(
    (f) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
  );
  if (!feature) return null;

  const coords =
    feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates[0] : feature.geometry.coordinates;
  if (!coords || coords.length < 2) return null;

  const startPt = turf.point([startCoord[0], startCoord[1]]);
  const endPt = turf.point([endCoord[0], endCoord[1]]);

  let bestStartIdx = -1;
  let bestStartDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = turf.distance(startPt, turf.point([coords[i][0], coords[i][1]]), { units: 'meters' });
    if (d < bestStartDist) {
      bestStartDist = d;
      bestStartIdx = i;
    }
  }

  if (bestStartDist > 220 || bestStartIdx === -1) return null;

  let bestEndIdx = -1;
  let bestEndDist = Infinity;
  for (let i = bestStartIdx + 1; i < coords.length; i++) {
    const d = turf.distance(endPt, turf.point([coords[i][0], coords[i][1]]), { units: 'meters' });
    if (d < bestEndDist) {
      bestEndDist = d;
      bestEndIdx = i;
    }
  }

  if (bestEndDist > 220 || bestEndIdx <= bestStartIdx) return null;

  // Estimar velocidad y tiempo en ese tramo a partir de los splits o la media de la actividad
  const totalPts = coords.length;
  const startRatio = bestStartIdx / Math.max(1, totalPts - 1);
  const endRatio = bestEndIdx / Math.max(1, totalPts - 1);
  const actDistKm = (activity.distance || 1000) / 1000;
  const approxStartKm = Math.floor(startRatio * actDistKm) + 1;
  const approxEndKm = Math.ceil(endRatio * actDistKm) + 1;

  let avgSpeedKmh = activity.averageSpeed || 20;
  if (activity.splits && activity.splits.length > 0) {
    const matchingSplits = activity.splits.filter((s) => s.split >= approxStartKm && s.split <= approxEndKm);
    if (matchingSplits.length > 0) {
      avgSpeedKmh =
        matchingSplits.reduce((sum, s) => sum + (s.averageSpeed || activity.averageSpeed || 20), 0) /
        matchingSplits.length;
    }
  }

  const elapsedTime = Math.max(5, Math.round((segDistanceMeters / 1000 / Math.max(4, avgSpeedKmh)) * 3600));
  const computedSpeed = Number(((segDistanceMeters / 1000 / (elapsedTime / 3600))).toFixed(1));

  return {
    elapsedTime,
    averageSpeed: computedSpeed,
    averageWatts: activity.averageWatts || null,
    averageHeartrate: activity.averageHeartrate || null
  };
}

/**
 * GET /api/segments
 * Lista todos los segmentos (o los que coinciden con una actividad concreta si se pasa ?activityId=...)
 */
router.get('/', async (req, res) => {
  try {
    const { activityId } = req.query;
    const segmentOwnerFilter = buildOwnershipFilter('segments', req.user._id, 'createdBy');
    const isPrivateSegments = SECURITY_CONFIG.dataPrivacy.segments === 'private';

    const rawSegments = await Segment.find(segmentOwnerFilter).sort({ createdAt: -1 }).lean();
    const allSegments = rawSegments.map((seg) => ({
      ...seg,
      efforts: isPrivateSegments
        ? (seg.efforts || []).filter((e) => String(e.userId) === String(req.user._id))
        : seg.efforts || []
    }));

    if (!activityId) {
      return res.json({ success: true, segments: allSegments });
    }

    const activity = await Activity.findOne({ _id: activityId, userId: req.user._id }).lean();
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    // Filtrar segmentos que pertenecen a esta ruta o cuyo trazado pasa por ella
    const matchedSegments = [];
    for (const seg of allSegments) {
      const isSource = seg.sourceActivityId && String(seg.sourceActivityId) === String(activity._id);
      const match = matchActivityToSegment(activity, seg.startCoord, seg.endCoord, seg.distanceMeters);

      if (isSource || match) {
        // Ordenar clasificación por menor tiempo (KOM primero)
        const leaderboard = [...(seg.efforts || [])].sort((a, b) => a.elapsedTime - b.elapsedTime);
        matchedSegments.push({
          ...seg,
          efforts: leaderboard,
          currentActivityEffort:
            leaderboard.find((e) => String(e.activityId) === String(activity._id)) || match || null
        });
      }
    }

    matchedSegments.sort((a, b) => a.startDistanceKm - b.startDistanceKm);
    res.json({ success: true, segments: matchedSegments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/segments
 * Permite crear un segmento de dos formas:
 * 1) Dibujándolo directamente en el mapa de la zona Segmentos (enviando `coordinates: [[lng, lat], ...]`)
 * 2) A partir de un tramo de una actividad (`activityId`, `startDistanceKm`, `endDistanceKm`)
 */
router.post('/', async (req, res) => {
  try {
    const { name, sportType = 'Ride', coordinates, activityId, startDistanceKm, endDistanceKm } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre del segmento es obligatorio' });
    }

    let sliceCoords = [];
    let distanceMeters = 0;
    let eleGain = 0;
    let averageGrade = 0;
    let maxGrade = 0;
    let category = 'Tramo';
    let sourceActId = null;
    let finalSportType = sportType || 'Ride';
    let startKm = 0;
    let endKm = 0;

    // MODO 1: Segmento dibujado directamente sobre el mapa
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      sliceCoords = coordinates.map((c) => [Number(c[0]), Number(c[1]), Number(c[2] || 0)]);
      const lineFeature = turf.lineString(sliceCoords.map((c) => [c[0], c[1]]));
      const distKm = turf.length(lineFeature, { units: 'kilometers' });
      distanceMeters = Math.round(distKm * 1000);

      if (distanceMeters < 50) {
        return res.status(400).json({
          success: false,
          error: 'El segmento dibujado es demasiado corto (mínimo 50 metros).'
        });
      }

      startKm = 0;
      endKm = Number(distKm.toFixed(2));
      let anchorEle = sliceCoords[0][2] || 0;
      for (let i = 1; i < sliceCoords.length; i++) {
        const currEle = sliceCoords[i][2] || 0;
        const diff = currEle - anchorEle;
        if (diff >= 0.65) {
          eleGain += diff;
          anchorEle = currEle;
        } else if (diff <= -0.65) {
          anchorEle = currEle;
        }
      }
      const netDiff = (sliceCoords[sliceCoords.length - 1][2] || 0) - (sliceCoords[0][2] || 0);
      if (netDiff > 0 && eleGain < netDiff) eleGain = netDiff;
      averageGrade = distanceMeters > 0 ? Number(((netDiff / distanceMeters) * 100).toFixed(1)) : 0;
      category = classifyClimbCategory(distanceMeters, averageGrade);
    } else if (activityId) {
      // MODO 2: Segmento extraído de una actividad existente
      startKm = Number(startDistanceKm);
      endKm = Number(endDistanceKm);
      if (Number.isNaN(startKm) || Number.isNaN(endKm) || endKm - startKm < 0.1) {
        return res.status(400).json({
          success: false,
          error: 'El segmento debe tener al menos 100 metros (0.10 km) entre el inicio y el fin'
        });
      }

      const activity = await Activity.findOne({ _id: activityId, userId: req.user._id }).lean();
      if (!activity) {
        return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
      }

      sourceActId = activity._id;
      finalSportType = activity.type || 'Ride';

      const feature = activity.geojson?.features?.find(
        (f) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
      );
      if (!feature) {
        return res.status(400).json({ success: false, error: 'La actividad no tiene geometría válida' });
      }

      const line =
        feature.geometry.type === 'MultiLineString'
          ? { type: 'Feature', geometry: { type: 'LineString', coordinates: feature.geometry.coordinates[0] } }
          : feature;

      const sliced = turf.lineSliceAlong(line, startKm, endKm, { units: 'kilometers' });
      sliceCoords = sliced.geometry.coordinates;
      if (!sliceCoords || sliceCoords.length < 2) {
        return res.status(400).json({ success: false, error: 'No se pudo extraer el tramo seleccionado' });
      }

      const profile = activity.elevationProfile || [];
      const getEleAtDist = (km) => {
        if (profile.length === 0) return 0;
        const pt = profile.find((p) => p.distance >= km) || profile[profile.length - 1];
        return pt ? pt.elevation : 0;
      };

      const startEle = sliceCoords[0][2] ?? getEleAtDist(startKm);
      const endEle = sliceCoords[sliceCoords.length - 1][2] ?? getEleAtDist(endKm);

      const subProfile = profile.filter((p) => p.distance >= startKm && p.distance <= endKm);
      if (subProfile.length >= 2) {
        for (let i = 1; i < subProfile.length; i++) {
          const diff = subProfile[i].elevation - subProfile[i - 1].elevation;
          if (diff > 0) eleGain += diff;
          maxGrade = Math.max(maxGrade, subProfile[i].grade || 0);
        }
      } else {
        eleGain = Math.max(0, endEle - startEle);
      }

      distanceMeters = Math.round((endKm - startKm) * 1000);
      const netDiff = endEle - startEle;
      averageGrade = distanceMeters > 0 ? Number(((netDiff / distanceMeters) * 100).toFixed(1)) : 0;
      if (maxGrade === 0) maxGrade = Math.max(averageGrade, Number((averageGrade * 1.35).toFixed(1)));
      category = classifyClimbCategory(distanceMeters, averageGrade);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Dibuja al menos 2 puntos en el mapa para crear el segmento'
      });
    }

    // Buscar esfuerzos respetando la política paramétrica de privacidad de rutas/segmentos (por defecto: solo del propio usuario)
    const activityScope = buildOwnershipFilter('routes', req.user._id, 'userId');
    const allActivities = await Activity.find(activityScope)
      .populate('userId', 'name')
      .select('userId title type gear startDate distance movingTime averageSpeed averageWatts averageHeartrate splits geojson')
      .lean();

    const efforts = [];
    for (const act of allActivities) {
      const m = matchActivityToSegment(act, sliceCoords[0], sliceCoords[sliceCoords.length - 1], distanceMeters);
      if (m) {
        efforts.push({
          activityId: act._id,
          userId: act.userId?._id || act.userId,
          userName: act.userId?.name || req.user.name,
          bikeName: act.gear || '',
          date: act.startDate || new Date(),
          ...m
        });
      }
    }

    efforts.sort((a, b) => a.elapsedTime - b.elapsedTime);

    const segment = await Segment.create({
      name: name.trim(),
      createdBy: req.user._id,
      creatorName: req.user.name,
      sourceActivityId: sourceActId,
      sportType: finalSportType,
      startDistanceKm: Number(startKm.toFixed(2)),
      endDistanceKm: Number(endKm.toFixed(2)),
      distanceMeters,
      elevationGain: Math.round(eleGain),
      averageGrade,
      maxGrade: Number(maxGrade.toFixed(1)),
      category,
      startCoord: sliceCoords[0],
      endCoord: sliceCoords[sliceCoords.length - 1],
      coordinates: sliceCoords,
      efforts
    });

    res.status(201).json({ success: true, segment });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/segments/:id
 * Eliminar un segmento
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Segment.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Segmento no encontrado' });
    }
    res.json({ success: true, message: 'Segmento eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
