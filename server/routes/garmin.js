import express from 'express';
import * as turf from '@turf/turf';
import User from '../models/User.js';
import Segment from '../models/Segment.js';
import WaterSource from '../models/WaterSource.js';
import Gear from '../models/Gear.js';
import { verifyToken, hashGarminApiKey } from '../utils/auth.js';
import { buildOwnershipFilter } from '../config/security.js';

const router = express.Router();

/**
 * Autenticación dedicada para Garmin Connect IQ:
 * Acepta `X-Garmin-Key: r3d_...` (o `Authorization: Bearer <r3d_... o JWT>`).
 * Siempre aisla estrictamente los datos al usuario propietario de la clave.
 */
async function requireGarminAuth(req, res, next) {
  try {
    const garminHeader = req.headers['x-garmin-key'];
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const candidate = String(garminHeader || bearer || '').trim();

    if (!candidate) {
      return res.status(401).json({ ok: false, err: 'Falta clave Garmin (X-Garmin-Key)' });
    }

    let user = null;
    if (candidate.startsWith('r3d_')) {
      const hash = hashGarminApiKey(candidate);
      user = await User.findOne({ garminApiKeyHash: hash }).lean();
    } else {
      const payload = verifyToken(candidate);
      if (payload?.id) {
        user = await User.findById(payload.id).lean();
      }
    }

    if (!user) {
      return res.status(401).json({ ok: false, err: 'Clave Garmin inválida o revocada' });
    }

    req.user = {
      id: String(user._id),
      _id: user._id,
      name: user.name,
      email: user.email
    };
    next();
  } catch {
    res.status(401).json({ ok: false, err: 'Error de autenticación Garmin' });
  }
}

router.use(requireGarminAuth);

function degreeToCardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/**
 * GET /api/garmin/live?lat=40.5658&lng=-3.2681&heading=90&speed=28
 * Endpoint ultraligero (< 700 bytes JSON) optimizado para el límite de RAM del Garmin Edge 1040.
 * Devuelve en tiempo real según la ubicación GPS del ciclista:
 * - Meteo actual y viento relativo a su rumbo (flecha, rachas, impacto en vatios)
 * - Fuente de agua potable más cercana (privadas del usuario + OpenStreetMap en 4 km)
 * - Segmento privado más cercano del usuario (distancia, pendiente, PR)
 */
router.get('/live', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const heading = Number.isFinite(Number(req.query.heading)) ? ((Number(req.query.heading) % 360) + 360) % 360 : 0;
    const speedKmh = Math.max(0, Number(req.query.speed) || 25);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ ok: false, err: 'Coordenadas lat/lng inválidas' });
    }

    const userPt = turf.point([lng, lat]);

    // 1. Consultar meteo + viento real en la coordenada actual (Open-Meteo)
    const meteoPromise = fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(
        4
      )}&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m&hourly=precipitation_probability&forecast_days=1&timezone=auto`
    )
      .then((r) => r.json())
      .catch(() => null);

    // 2. Consultar fuentes propias del usuario + segmentos propios + bicicleta favorita
    const waterFilter = buildOwnershipFilter('waterSources', req.user._id, 'createdBy');
    const segFilter = buildOwnershipFilter('segments', req.user._id, 'createdBy');

    const [meteoJson, userWaterSources, userSegments, favBike] = await Promise.all([
      meteoPromise,
      WaterSource.find(waterFilter).select('name lng lat').lean(),
      Segment.find(segFilter).select('name startCoord averageGrade distanceMeters efforts').lean(),
      Gear.findOne({ userId: req.user._id, retired: false }).sort({ isDefault: -1 }).select('name bikeType').lean()
    ]);

    // 3. Procesar viento relativo al rumbo del Edge 1040
    const curr = meteoJson?.current || {};
    const temp = Math.round(curr.temperature_2m ?? 16);
    const feel = Math.round(curr.apparent_temperature ?? temp);
    const wind = Number((curr.wind_speed_10m ?? 10).toFixed(1));
    const gust = Number((curr.wind_gusts_10m ?? wind * 1.35).toFixed(1));
    const wDir = Math.round(curr.wind_direction_10m ?? 225); // De dónde viene el viento (0=N)

    const currentHour = new Date().getHours();
    const rainProb = Math.round(meteoJson?.hourly?.precipitation_probability?.[currentHour] ?? 0);

    // Ángulo relativo del viento respecto al manillar (0° = viento de cara, 180° = viento de cola)
    const angleRad = ((wDir - heading) * Math.PI) / 180;
    const tailwindComp = -wind * Math.cos(angleRad);
    let wMode = 'LATERAL';
    if (tailwindComp >= 2.8) wMode = 'FAVOR';
    else if (tailwindComp <= -2.8) wMode = 'CONTRA';

    // Dirección HACIA donde sopla el viento relativa a la pantalla del Garmin (0° = hacia arriba/adelante)
    const windBlowsTowards = (wDir + 180) % 360;
    const wRel = Math.round(((windBlowsTowards - heading) % 360 + 360) % 360);
    const wWatts = Math.round(-tailwindComp * 1.85);

    // 4. Fuente de agua potable más cercana (primero propias, luego OSM Overpass en radio 3.5 km)
    let nearestWater = null;
    for (const src of userWaterSources) {
      const distKm = turf.distance(userPt, turf.point([src.lng, src.lat]), { units: 'kilometers' });
      if (distKm <= 12 && (!nearestWater || distKm < nearestWater.distKm)) {
        nearestWater = {
          name: String(src.name || 'Fuente').slice(0, 22),
          distKm: Number(distKm.toFixed(1))
        };
      }
    }

    if (!nearestWater) {
      try {
        const q = `[out:json][timeout:4];node["amenity"="drinking_water"](around:3500,${lat.toFixed(4)},${lng.toFixed(
          4
        )});out body 8;`;
        const osmRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`, {
          signal: AbortSignal.timeout(3500)
        });
        const osmJson = await osmRes.json();
        for (const el of osmJson?.elements || []) {
          if (el.lat && el.lon) {
            const dKm = turf.distance(userPt, turf.point([el.lon, el.lat]), { units: 'kilometers' });
            if (!nearestWater || dKm < nearestWater.distKm) {
              nearestWater = {
                name: String(el.tags?.name || 'Fuente potable').slice(0, 22),
                distKm: Number(dKm.toFixed(1))
              };
            }
          }
        }
      } catch {
        // Timeout o Overpass ocupado: continuamos sin bloquear al Garmin
      }
    }

    // 5. Segmento privado más cercano (dentro de 10 km)
    let nearestSeg = null;
    for (const seg of userSegments) {
      if (!Array.isArray(seg.startCoord) || seg.startCoord.length < 2) continue;
      const dKm = turf.distance(userPt, turf.point([seg.startCoord[0], seg.startCoord[1]]), { units: 'kilometers' });
      if (dKm <= 10 && (!nearestSeg || dKm < nearestSeg.distKm)) {
        const myEfforts = (seg.efforts || [])
          .filter((e) => String(e.userId) === String(req.user._id))
          .sort((a, b) => a.elapsedTime - b.elapsedTime);
        nearestSeg = {
          name: String(seg.name || 'Segmento').slice(0, 22),
          distKm: Number(dKm.toFixed(1)),
          grade: Number(seg.averageGrade || 0),
          prSec: myEfforts[0]?.elapsedTime || 0
        };
      }
    }

    // Respuesta JSON compacta diseñada para Connect IQ
    res.json({
      ok: true,
      ts: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      temp,
      feel,
      rain: rainProb,
      wind,
      gust,
      wCard: degreeToCardinal(wDir),
      wRel,
      wMode,
      wWatts,
      spd: Math.round(speedKmh),
      water: nearestWater,
      seg: nearestSeg,
      bike: favBike ? String(favBike.name).slice(0, 20) : ''
    });
  } catch (err) {
    res.status(500).json({ ok: false, err: 'Error calculando telemetría Garmin' });
  }
});

export default router;
