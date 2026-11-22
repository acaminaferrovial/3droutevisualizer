import Activity from '../models/Activity.js';
import Gear from '../models/Gear.js';
import User from '../models/User.js';
import Segment from '../models/Segment.js';
import * as turf from '@turf/turf';
import { hashPassword } from './auth.js';

/**
 * Genera una línea de coordenadas interpolada con elevación
 */
function generateTrack(startCoord, endCoord, count, baseEle, eleVariation) {
  const coords = [];
  const elevationProfile = [];
  const [startLng, startLat] = startCoord;
  const [endLng, endLat] = endCoord;

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const curve = Math.sin(t * Math.PI) * 0.008;
    const lng = Number((startLng + (endLng - startLng) * t + curve).toFixed(5));
    const lat = Number((startLat + (endLat - startLat) * t + curve * 0.5).toFixed(5));
    const ele = Math.round(baseEle + Math.sin(t * Math.PI * 1.5) * eleVariation + Math.sin(i * 0.5) * 5);

    coords.push([lng, lat, ele]);

    if (i % Math.max(1, Math.floor(count / 30)) === 0) {
      elevationProfile.push({
        distance: Number((t * 18.5).toFixed(2)),
        elevation: ele,
        grade: Number((Math.sin(t * Math.PI) * 7.5).toFixed(1))
      });
    }
  }

  return { coords, elevationProfile };
}

export async function seedInitialActivities(targetUserId = null) {
  let primaryUser = await User.findOne({ email: 'alberto@route3d.com' });
  if (!primaryUser) {
    primaryUser = await User.create({
      name: 'Alberto Camina',
      email: 'alberto@route3d.com',
      passwordHash: hashPassword('123456'),
      bio: 'Ciclista de carretera, MTB XC y gravel. Entrenamientos en montaña y puertos.',
      location: 'Madrid, España',
      primarySport: 'Ride',
      weightKg: 71,
      ftpWatts: 285,
      maxHeartrate: 188,
      restingHeartrate: 48
    });
    console.log('✅ Usuario principal creado: alberto@route3d.com / 123456');
  } else if (primaryUser.bio && primaryUser.bio.includes('trail runner')) {
    primaryUser.bio = 'Ciclista de carretera, MTB XC y gravel. Entrenamientos en montaña y puertos.';
    await primaryUser.save();
  }

  let secondUser = await User.findOne({ email: 'cristina@route3d.com' });
  if (!secondUser) {
    secondUser = await User.create({
      name: 'Cristina',
      email: 'cristina@route3d.com',
      passwordHash: hashPassword('123456'),
      bio: 'Rutas de gravel y ciclismo de carretera de fin de semana.',
      location: 'Madrid, España',
      primarySport: 'GravelRide',
      weightKg: 58,
      ftpWatts: 195,
      maxHeartrate: 184,
      restingHeartrate: 54
    });
    console.log('✅ Segundo usuario creado: cristina@route3d.com / 123456');
  }

  const ownerId = targetUserId || primaryUser._id;

  // Asignar actividades y bicicletas huérfanas al usuario principal
  await Activity.updateMany({ userId: null }, { $set: { userId: primaryUser._id } });
  await Gear.updateMany({ userId: null }, { $set: { userId: primaryUser._id } });

  // Limpiar zapatillas heredadas para que el garaje sea 100% ciclismo
  await Gear.deleteMany({ category: 'shoes' });

  // Enriquecer bicicletas existentes que aún no tengan datos de SAG o historial de revisiones
  const oiz = await Gear.findOne({ name: 'Orbea Oiz M-Pro' });
  if (oiz && (!oiz.maintenanceLogs || oiz.maintenanceLogs.length === 0)) {
    oiz.suspension = {
      forkModel: 'Fox 34 Step-Cast Factory Kashima 120mm',
      forkSag: 20,
      forkPsi: 76,
      forkRebound: '-6 clicks',
      shockModel: 'Fox Float DPS Factory Kashima 120mm',
      shockSag: 25,
      shockPsi: 165,
      shockRebound: '-5 clicks'
    };
    oiz.maintenanceLogs = [
      {
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
        odometerKm: 590,
        type: 'suspension',
        title: 'Ajuste de aire y SAG en horquilla y amortiguador',
        details:
          'Revisada presión con bomba digital Fox. Horquilla a 76 PSI (20% SAG) y amortiguador a 165 PSI (25% SAG). Limpieza de barras y guardapolvos.',
        forkSag: 20,
        forkPsi: 76,
        shockSag: 25,
        shockPsi: 165
      },
      {
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28),
        odometerKm: 410,
        type: 'tires',
        title: 'Recarga de líquido tubeless y revisión de cadena',
        details: 'Añadidos 60 ml de sellante Stan’s en cada rueda. Cadena al 0.25% de desgaste, encerada.'
      }
    ];
    await oiz.save();
  }

  const tarmac = await Gear.findOne({ name: 'Specialized Tarmac SL7' });
  if (tarmac && (!tarmac.maintenanceLogs || tarmac.maintenanceLogs.length === 0)) {
    tarmac.maintenanceLogs = [
      {
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
        odometerKm: 1320,
        type: 'drivetrain',
        title: 'Cambio de cadena Shimano Ultegra 12v y encerado',
        details: 'Sustituida cadena CN-M8100 nueva con eslabón rápido. Ajuste fino del cambio Di2 y pastillas delanteras nuevas.'
      }
    ];
    await tarmac.save();
  }

  const gearCount = await Gear.countDocuments({ userId: ownerId });
  if (gearCount === 0) {
    await Gear.create([
      {
        userId: ownerId,
        name: 'Specialized Tarmac SL7',
        category: 'bike',
        bikeType: 'Road',
        brand: 'Specialized',
        model: 'Tarmac SL7 Fact 10r',
        weightKg: 7.3,
        initialDistanceKm: 1450,
        maxDistanceKm: 5000,
        notes: 'Shimano Ultegra Di2 12v · Ruedas Roval Rapide CL · Cubiertas GP5000 28mm',
        isDefault: true,
        maintenanceLogs: [
          {
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
            odometerKm: 1320,
            type: 'drivetrain',
            title: 'Cambio de cadena Shimano Ultegra 12v y encerado',
            details: 'Sustituida cadena CN-M8100 nueva con eslabón rápido. Ajuste fino del cambio Di2.'
          }
        ]
      },
      {
        userId: ownerId,
        name: 'Orbea Oiz M-Pro',
        category: 'bike',
        bikeType: 'MTB',
        brand: 'Orbea',
        model: 'Oiz M-Pro XC',
        weightKg: 10.4,
        initialDistanceKm: 620,
        maxDistanceKm: 3000,
        notes: 'Fox 34 Step-Cast Kashima · Maxxis Recon Race Tubeless',
        isDefault: false,
        suspension: {
          forkModel: 'Fox 34 Step-Cast Factory Kashima 120mm',
          forkSag: 20,
          forkPsi: 76,
          forkRebound: '-6 clicks',
          shockModel: 'Fox Float DPS Factory Kashima 120mm',
          shockSag: 25,
          shockPsi: 165,
          shockRebound: '-5 clicks'
        },
        maintenanceLogs: [
          {
            date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
            odometerKm: 590,
            type: 'suspension',
            title: 'Ajuste de aire y SAG en horquilla y amortiguador',
            details: 'Horquilla a 76 PSI (20% SAG) y amortiguador a 165 PSI (25% SAG).',
            forkSag: 20,
            forkPsi: 76,
            shockSag: 25,
            shockPsi: 165
          }
        ]
      },
      {
        userId: ownerId,
        name: 'Canyon Grail CF SL 8',
        category: 'bike',
        bikeType: 'Gravel',
        brand: 'Canyon',
        model: 'Grail CF SL 8',
        weightKg: 8.8,
        initialDistanceKm: 340,
        maxDistanceKm: 4000,
        notes: 'Shimano GRX 820 · Schwalbe G-One R 40mm Tubeless',
        isDefault: false
      }
    ]);
    console.log('✅ Bicicletas iniciales sembradas en MongoDB');
  }

  // Sembrar bicicleta inicial para el segundo usuario si no tiene ninguna
  const secondGearCount = await Gear.countDocuments({ userId: secondUser._id });
  if (secondGearCount === 0) {
    await Gear.create([
      {
        userId: secondUser._id,
        name: 'Trek Checkpoint SL 6',
        category: 'bike',
        bikeType: 'Gravel',
        brand: 'Trek',
        model: 'Checkpoint SL 6 eTap',
        weightKg: 9.1,
        initialDistanceKm: 480,
        maxDistanceKm: 4000,
        notes: 'SRAM Rival XPLR eTap AXS · Cubiertas Bontrager Girona Pro 42mm',
        isDefault: true
      }
    ]);
  }

  // Si existen las actividades antiguas de correr/trail de la semilla anterior, las convertimos en rutas 100% de ciclismo (MTB y Gravel)
  const legacyTrail = await Activity.findOne({ title: /Yosemite Valley/i });
  if (legacyTrail) {
    legacyTrail.title = 'XC Maratón Sierra de Guadarrama y Abantos';
    legacyTrail.type = 'MountainBikeRide';
    legacyTrail.description =
      'Ruta MTB XC por senderos y pistas de San Lorenzo de El Escorial y Abantos. Terreno técnico de piedra suelta donde el SAG al 20%/25% de la Oiz trabajó perfecto.';
    legacyTrail.distance = 28400;
    legacyTrail.movingTime = 4920;
    legacyTrail.elapsedTime = 5200;
    legacyTrail.totalElevationGain = 940;
    legacyTrail.averageSpeed = 20.8;
    legacyTrail.maxSpeed = 46.5;
    legacyTrail.averageCadence = 76;
    legacyTrail.averageWatts = 218;
    legacyTrail.gear = 'Orbea Oiz M-Pro';
    if (oiz) legacyTrail.gearId = oiz._id;
    await legacyTrail.save();
  }

  const legacyRun = await Activity.findOne({ title: /10K Rodaje Progresivo/i });
  const grail = await Gear.findOne({ name: 'Canyon Grail CF SL 8' });
  if (legacyRun) {
    legacyRun.title = 'Gravel Rápido por Pistas de El Pardo y Tres Cantos';
    legacyRun.type = 'GravelRide';
    legacyRun.description =
      'Rodaje rápido en bici de gravel encadenando pistas compactas y repechos cortos. Cubiertas a 2.1 bar.';
    legacyRun.distance = 36500;
    legacyRun.movingTime = 4680;
    legacyRun.elapsedTime = 4800;
    legacyRun.totalElevationGain = 485;
    legacyRun.averageSpeed = 28.1;
    legacyRun.maxSpeed = 51.4;
    legacyRun.averageCadence = 84;
    legacyRun.averageWatts = 210;
    legacyRun.gear = 'Canyon Grail CF SL 8';
    if (grail) legacyRun.gearId = grail._id;
    await legacyRun.save();
  }

  const covadongaAct = await Activity.findOne({ title: /Lagos de Covadonga/i });
  if (covadongaAct && covadongaAct.title.startsWith('🚴')) {
    covadongaAct.title = 'Subida a los Lagos de Covadonga';
    if (tarmac) covadongaAct.gearId = tarmac._id;
    await covadongaAct.save();
  }

  // Sembrar segmentos iniciales de ejemplo si aún no hay ninguno
  const segCount = await Segment.countDocuments();
  if (segCount === 0 && covadongaAct) {
    const feat = covadongaAct.geojson?.features?.[0];
    if (feat) {
      const totalKm = turf.length(feat, { units: 'kilometers' });
      const s1Start = Number((totalKm * 0.35).toFixed(2));
      const s1End = Number((totalKm * 0.55).toFixed(2));
      const sliced1 = turf.lineSliceAlong(feat, s1Start, s1End, { units: 'kilometers' });

      const s2Start = Number((totalKm * 0.65).toFixed(2));
      const s2End = Number((totalKm * 0.92).toFixed(2));
      const sliced2 = turf.lineSliceAlong(feat, s2Start, s2End, { units: 'kilometers' });

      await Segment.create([
        {
          name: 'La Huesera (Tramo Reina Covadonga)',
          createdBy: primaryUser._id,
          creatorName: primaryUser.name,
          sourceActivityId: covadongaAct._id,
          sportType: 'Ride',
          startDistanceKm: s1Start,
          endDistanceKm: s1End,
          distanceMeters: Math.round((s1End - s1Start) * 1000),
          elevationGain: 235,
          averageGrade: 11.4,
          maxGrade: 15.2,
          category: '1ª Cat',
          startCoord: sliced1.geometry.coordinates[0],
          endCoord: sliced1.geometry.coordinates[sliced1.geometry.coordinates.length - 1],
          coordinates: sliced1.geometry.coordinates,
          efforts: [
            {
              activityId: covadongaAct._id,
              userId: primaryUser._id,
              userName: primaryUser.name,
              bikeName: 'Specialized Tarmac SL7',
              date: covadongaAct.startDate,
              elapsedTime: 590,
              averageSpeed: 12.6,
              averageWatts: 275,
              averageHeartrate: 175
            },
            {
              activityId: covadongaAct._id,
              userId: secondUser._id,
              userName: secondUser.name,
              bikeName: 'Trek Checkpoint SL 6',
              date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
              elapsedTime: 685,
              averageSpeed: 10.8,
              averageWatts: 198,
              averageHeartrate: 171
            }
          ]
        },
        {
          name: 'Mirador de la Reina → Lago Enol',
          createdBy: primaryUser._id,
          creatorName: primaryUser.name,
          sourceActivityId: covadongaAct._id,
          sportType: 'Ride',
          startDistanceKm: s2Start,
          endDistanceKm: s2End,
          distanceMeters: Math.round((s2End - s2Start) * 1000),
          elevationGain: 260,
          averageGrade: 8.1,
          maxGrade: 12.0,
          category: '2ª Cat',
          startCoord: sliced2.geometry.coordinates[0],
          endCoord: sliced2.geometry.coordinates[sliced2.geometry.coordinates.length - 1],
          coordinates: sliced2.geometry.coordinates,
          efforts: [
            {
              activityId: covadongaAct._id,
              userId: primaryUser._id,
              userName: primaryUser.name,
              bikeName: 'Specialized Tarmac SL7',
              date: covadongaAct.startDate,
              elapsedTime: 710,
              averageSpeed: 16.4,
              averageWatts: 252,
              averageHeartrate: 169
            }
          ]
        }
      ]);
      console.log('✅ Segmentos iniciales sembrados en MongoDB');
    }
  }

  const count = await Activity.countDocuments({ userId: ownerId });
  if (count > 0) return;

  // Semilla limpia 100% ciclismo si la colección está vacía
  const covadongaTrack = generateTrack([-5.05, 43.31], [-4.985, 43.272], 80, 150, 960);
  const covadongaSplits = [
    { split: 1, distance: 1000, elapsedTime: 160, movingTime: 160, elevationDifference: 18, averageSpeed: 22.5, averageHeartrate: 135 },
    { split: 2, distance: 1000, elapsedTime: 175, movingTime: 175, elevationDifference: 32, averageSpeed: 20.6, averageHeartrate: 142 },
    { split: 3, distance: 1000, elapsedTime: 195, movingTime: 195, elevationDifference: 58, averageSpeed: 18.5, averageHeartrate: 152 },
    { split: 4, distance: 1000, elapsedTime: 240, movingTime: 240, elevationDifference: 85, averageSpeed: 15.0, averageHeartrate: 164 },
    { split: 5, distance: 1000, elapsedTime: 290, movingTime: 290, elevationDifference: 110, averageSpeed: 12.4, averageHeartrate: 171 },
    { split: 6, distance: 1000, elapsedTime: 320, movingTime: 320, elevationDifference: 130, averageSpeed: 11.2, averageHeartrate: 176 },
    { split: 7, distance: 1000, elapsedTime: 310, movingTime: 310, elevationDifference: 125, averageSpeed: 11.6, averageHeartrate: 174 },
    { split: 8, distance: 1000, elapsedTime: 280, movingTime: 280, elevationDifference: 95, averageSpeed: 12.8, averageHeartrate: 168 },
    { split: 9, distance: 1000, elapsedTime: 220, movingTime: 220, elevationDifference: 60, averageSpeed: 16.3, averageHeartrate: 159 },
    { split: 10, distance: 1000, elapsedTime: 180, movingTime: 180, elevationDifference: 40, averageSpeed: 20.0, averageHeartrate: 151 }
  ];

  const mtbTrack = generateTrack([-4.148, 40.592], [-4.125, 40.618], 70, 980, 520);
  const gravelTrack = generateTrack([-3.775, 40.515], [-3.715, 40.565], 60, 650, 210);

  await Activity.create([
    {
      userId: ownerId,
      title: 'Subida a los Lagos de Covadonga',
      type: 'Ride',
      description:
        'Entrenamiento de fondo y escalada. Sensaciones duras en La Huesera con rampas del 15%, manteniendo cadencia constante hasta el Lago Enol.',
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
      distance: 12750,
      movingTime: 2970,
      elapsedTime: 3180,
      totalElevationGain: 965,
      totalElevationLoss: 45,
      averageSpeed: 15.4,
      maxSpeed: 48.2,
      averageHeartrate: 161,
      maxHeartrate: 184,
      averageCadence: 78,
      averageWatts: 245,
      calories: 820,
      perceivedExertion: 8,
      gear: 'Specialized Tarmac SL7',
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Subida a los Lagos de Covadonga', type: 'Ride' },
            geometry: { type: 'LineString', coordinates: covadongaTrack.coords }
          }
        ]
      },
      splits: covadongaSplits,
      elevationProfile: covadongaTrack.elevationProfile,
      bounds: { minLng: -5.06, minLat: 43.26, maxLng: -4.97, maxLat: 43.32 }
    },
    {
      userId: ownerId,
      title: 'XC Maratón Sierra de Guadarrama y Abantos',
      type: 'MountainBikeRide',
      description:
        'Ruta MTB XC por senderos y pistas de El Escorial y Abantos. Terreno técnico donde el SAG al 20%/25% de la Oiz trabajó perfecto.',
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      distance: 28400,
      movingTime: 4920,
      elapsedTime: 5200,
      totalElevationGain: 940,
      totalElevationLoss: 910,
      averageSpeed: 20.8,
      maxSpeed: 46.5,
      averageHeartrate: 158,
      maxHeartrate: 179,
      averageCadence: 76,
      averageWatts: 218,
      calories: 915,
      perceivedExertion: 8,
      gear: 'Orbea Oiz M-Pro',
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'XC Maratón Sierra de Guadarrama y Abantos', type: 'MountainBikeRide' },
            geometry: { type: 'LineString', coordinates: mtbTrack.coords }
          }
        ]
      },
      splits: covadongaSplits.slice(0, 7),
      elevationProfile: mtbTrack.elevationProfile,
      bounds: { minLng: -4.16, minLat: 40.58, maxLng: -4.11, maxLat: 40.63 }
    },
    {
      userId: ownerId,
      title: 'Gravel Rápido por Pistas de El Pardo y Tres Cantos',
      type: 'GravelRide',
      description: 'Rodaje rápido en bici de gravel encadenando pistas compactas y repechos cortos. Cubiertas a 2.1 bar.',
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      distance: 36500,
      movingTime: 4680,
      elapsedTime: 4800,
      totalElevationGain: 485,
      totalElevationLoss: 480,
      averageSpeed: 28.1,
      maxSpeed: 51.4,
      averageHeartrate: 152,
      maxHeartrate: 174,
      averageCadence: 84,
      averageWatts: 210,
      calories: 1090,
      perceivedExertion: 7,
      gear: 'Canyon Grail CF SL 8',
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Gravel Rápido por Pistas de El Pardo y Tres Cantos', type: 'GravelRide' },
            geometry: { type: 'LineString', coordinates: gravelTrack.coords }
          }
        ]
      },
      splits: covadongaSplits,
      elevationProfile: gravelTrack.elevationProfile,
      bounds: { minLng: -3.79, minLat: 40.5, maxLng: -3.7, maxLat: 40.58 }
    }
  ]);

  console.log('✅ Rutas iniciales de ciclismo sembradas en MongoDB');
}
