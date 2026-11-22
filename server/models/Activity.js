import mongoose from 'mongoose';

const SplitSchema = new mongoose.Schema({
  split: { type: Number, required: true }, // 1, 2, 3 (km)
  distance: { type: Number, default: 1000 }, // metros
  elapsedTime: { type: Number, default: 0 }, // segundos
  movingTime: { type: Number, default: 0 }, // segundos
  elevationDifference: { type: Number, default: 0 }, // metros
  averageSpeed: { type: Number, default: 0 }, // km/h
  averageHeartrate: { type: Number, default: null }
}, { _id: false });

const ElevationPointSchema = new mongoose.Schema({
  distance: { type: Number, required: true }, // km desde el inicio
  elevation: { type: Number, required: true }, // metros sobre el nivel del mar
  grade: { type: Number, default: 0 } // pendiente en %
}, { _id: false });

const ActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  title: { type: String, required: true, trim: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide', 'Run', 'TrailRun', 'Hike', 'Walk', 'Other'],
    default: 'Ride'
  },
  description: { type: String, default: '' },
  startDate: { type: Date, default: Date.now },
  
  // Métricas principales (estilo Strava)
  distance: { type: Number, required: true, default: 0 }, // En metros
  movingTime: { type: Number, required: true, default: 0 }, // En segundos
  elapsedTime: { type: Number, default: 0 }, // En segundos
  totalElevationGain: { type: Number, default: 0 }, // En metros (+m)
  totalElevationLoss: { type: Number, default: 0 }, // En metros (-m)
  
  // Rendimiento y sensores
  averageSpeed: { type: Number, default: 0 }, // En km/h
  maxSpeed: { type: Number, default: 0 }, // En km/h
  averageHeartrate: { type: Number, default: null }, // bpm
  maxHeartrate: { type: Number, default: null }, // bpm
  averageCadence: { type: Number, default: null }, // rpm
  averageWatts: { type: Number, default: null }, // vatios
  calories: { type: Number, default: 0 }, // kcal
  
  // Personalización del atleta
  perceivedExertion: { type: Number, min: 1, max: 10, default: null }, // Escala RPE 1-10
  gear: { type: String, default: '' }, // Zapatillas, bici, etc.
  gearId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gear', default: null },
  
  // Datos Geoespaciales y perfiles
  geojson: { type: Object, required: true }, // GeoJSON Feature / FeatureCollection
  splits: [SplitSchema],
  elevationProfile: [ElevationPointSchema],
  bounds: {
    minLng: { type: Number },
    minLat: { type: Number },
    maxLng: { type: Number },
    maxLat: { type: Number }
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
ActivitySchema.index({ startDate: -1 });
ActivitySchema.index({ type: 1 });

const Activity = mongoose.model('Activity', ActivitySchema);

export default Activity;
