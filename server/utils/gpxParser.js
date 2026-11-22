import { DOMParser } from '@xmldom/xmldom';

/**
 * Fórmula de Haversine para calcular distancia entre dos coordenadas en metros
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Parsea un archivo GPX y extrae métricas de Strava
 */
export function parseGPX(gpxContent, options = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxContent, 'text/xml');

  // Obtener nombre de la actividad
  let title = options.title;
  if (!title) {
    const nameEl = doc.getElementsByTagName('name')[0];
    title = nameEl ? nameEl.textContent.trim() : 'Actividad sin título';
  }

  // Obtener modalidad de ciclismo sugerida
  let type = options.type || 'Ride';
  const typeEl = doc.getElementsByTagName('type')[0];
  if (typeEl && !options.type) {
    const rawType = typeEl.textContent.trim().toLowerCase();
    if (rawType.includes('mtb') || rawType.includes('mountain')) type = 'MountainBikeRide';
    else if (rawType.includes('gravel')) type = 'GravelRide';
    else if (rawType.includes('virtual') || rawType.includes('indoor')) type = 'VirtualRide';
    else type = 'Ride';
  }

  const trkpts = doc.getElementsByTagName('trkpt');
  if (!trkpts || trkpts.length === 0) {
    throw new Error('El archivo GPX no contiene puntos de track (trkpt).');
  }

  const points = [];
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));

    if (isNaN(lat) || isNaN(lon)) continue;

    minLng = Math.min(minLng, lon);
    maxLng = Math.max(maxLng, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);

    const eleEl = pt.getElementsByTagName('ele')[0];
    const ele = eleEl ? parseFloat(eleEl.textContent) : 0;

    const timeEl = pt.getElementsByTagName('time')[0];
    const time = timeEl ? new Date(timeEl.textContent) : null;

    // Buscar HR en extensiones (gpxtpx:hr o hr)
    let hr = null;
    const hrEl = pt.getElementsByTagName('gpxtpx:hr')[0] || pt.getElementsByTagName('hr')[0];
    if (hrEl) hr = parseInt(hrEl.textContent, 10);

    // Buscar Cadence (gpxtpx:cad o cad)
    let cad = null;
    const cadEl = pt.getElementsByTagName('gpxtpx:cad')[0] || pt.getElementsByTagName('cad')[0];
    if (cadEl) cad = parseInt(cadEl.textContent, 10);

    points.push({ lat, lon, ele, time, hr, cad });
  }

  if (points.length < 2) {
    throw new Error('El archivo GPX contiene menos de 2 coordenadas válidas.');
  }

  // Cálculo de métricas
  let totalDistance = 0;
  let totalElevationGain = 0;
  let totalElevationLoss = 0;
  let anchorEle = points[0].ele || 0;
  let movingTime = 0;
  let maxSpeed = 0;
  let totalHr = 0;
  let countHr = 0;
  let maxHr = 0;

  const coordinates = [];
  const splits = [];
  let currentSplitIndex = 1;
  let currentSplitStartDist = 0;
  let currentSplitStartTime = points[0].time;
  let currentSplitStartEle = points[0].ele;
  let currentSplitMovingTime = 0;

  const elevationProfile = [];
  const profileInterval = Math.max(1, Math.floor(points.length / 100)); // ~100 puntos en la gráfica

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    coordinates.push([curr.lon, curr.lat, curr.ele]);

    if (curr.hr) {
      totalHr += curr.hr;
      countHr++;
      maxHr = Math.max(maxHr, curr.hr);
    }

    if (i > 0) {
      const prev = points[i - 1];
      const dist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
      totalDistance += dist;

      // Desnivel acumulado con histéresis por ancla (acumula toda subida/bajada suave continua sin perder metros en pendientes tendidas)
      const anchorDiff = curr.ele - anchorEle;
      if (anchorDiff >= 0.7) {
        totalElevationGain += anchorDiff;
        anchorEle = curr.ele;
      } else if (anchorDiff <= -0.7) {
        totalElevationLoss += Math.abs(anchorDiff);
        anchorEle = curr.ele;
      }

      // Tiempo y velocidad
      if (curr.time && prev.time) {
        const timeDiffSec = (curr.time - prev.time) / 1000;
        if (timeDiffSec > 0 && timeDiffSec < 3600) {
          const speedKmh = (dist / timeDiffSec) * 3.6;
          // Si la velocidad supera 1.5 km/h consideramos tiempo en movimiento
          if (speedKmh > 1.2) {
            movingTime += timeDiffSec;
            currentSplitMovingTime += timeDiffSec;
          }
          if (speedKmh < 120) { // evitar saltos locos de GPS
            maxSpeed = Math.max(maxSpeed, speedKmh);
          }
        }
      }
    }

    // Splits cada 1000m (1 km)
    const distFromSplitStart = totalDistance - currentSplitStartDist;
    if (distFromSplitStart >= 1000 || i === points.length - 1) {
      const splitTime = curr.time && currentSplitStartTime 
        ? Math.max(1, (curr.time - currentSplitStartTime) / 1000)
        : Math.max(1, (distFromSplitStart / (totalDistance / Math.max(1, movingTime))));

      const splitSpeed = (distFromSplitStart / Math.max(1, currentSplitMovingTime || splitTime)) * 3.6;

      splits.push({
        split: currentSplitIndex++,
        distance: Math.round(distFromSplitStart),
        elapsedTime: Math.round(splitTime),
        movingTime: Math.round(currentSplitMovingTime || splitTime),
        elevationDifference: Math.round(curr.ele - currentSplitStartEle),
        averageSpeed: Number(splitSpeed.toFixed(2)),
        averageHeartrate: countHr ? Math.round(totalHr / countHr) : null
      });

      currentSplitStartDist = totalDistance;
      currentSplitStartTime = curr.time;
      currentSplitStartEle = curr.ele;
      currentSplitMovingTime = 0;
    }

    // Puntos del perfil de elevación
    if (i % profileInterval === 0 || i === points.length - 1) {
      const distKm = Number((totalDistance / 1000).toFixed(2));
      const grade = i > 0 && totalDistance > 0 
        ? Number((((curr.ele - points[i - 1].ele) / Math.max(1, haversineDistance(points[i - 1].lat, points[i - 1].lon, curr.lat, curr.lon))) * 100).toFixed(1))
        : 0;

      elevationProfile.push({
        distance: distKm,
        elevation: Math.round(curr.ele),
        grade: Math.min(35, Math.max(-35, grade))
      });
    }
  }

  // Tiempos finales
  let elapsedTime = 0;
  if (points[0].time && points[points.length - 1].time) {
    elapsedTime = Math.max(1, (points[points.length - 1].time - points[0].time) / 1000);
  } else {
    elapsedTime = movingTime || Math.round((totalDistance / 1000) * 360); // 10 km/h estimado
    movingTime = elapsedTime;
  }

  if (movingTime <= 0) movingTime = elapsedTime;

  const averageSpeed = totalDistance > 0 && movingTime > 0
    ? (totalDistance / movingTime) * 3.6
    : 0;

  // Estimación de calorías en ciclismo (basada en distancia y desnivel acumulado)
  const distKm = totalDistance / 1000;
  const calories = Math.round(distKm * 28 + totalElevationGain * 0.15);

  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: title,
          type: type
        },
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    ]
  };

  return {
    title,
    type,
    startDate: points[0].time || new Date(),
    distance: Math.round(totalDistance),
    movingTime: Math.round(movingTime),
    elapsedTime: Math.round(elapsedTime),
    totalElevationGain: Math.round(totalElevationGain),
    totalElevationLoss: Math.round(totalElevationLoss),
    averageSpeed: Number(averageSpeed.toFixed(2)),
    maxSpeed: Number(maxSpeed.toFixed(2)),
    averageHeartrate: countHr ? Math.round(totalHr / countHr) : null,
    maxHeartrate: maxHr || null,
    calories,
    geojson,
    splits,
    elevationProfile,
    bounds: { minLng, minLat, maxLng, maxLat }
  };
}
