import mongoose from 'mongoose';

const SegmentEffortSchema = new mongoose.Schema(
  {
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, default: 'Ciclista' },
    bikeName: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    elapsedTime: { type: Number, required: true }, // segundos en el segmento
    averageSpeed: { type: Number, required: true }, // km/h en el segmento
    averageWatts: { type: Number, default: null },
    averageHeartrate: { type: Number, default: null }
  },
  { _id: true }
);

const SegmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    creatorName: { type: String, default: 'Ciclista' },
    sourceActivityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', default: null },
    sportType: { type: String, default: 'Ride' },

    // Rango de kilómetros dentro de la ruta origen (opcional si se dibuja libremente en el mapa) y geometría propia
    startDistanceKm: { type: Number, default: 0 },
    endDistanceKm: { type: Number, default: 0 },
    distanceMeters: { type: Number, required: true },
    elevationGain: { type: Number, default: 0 },
    averageGrade: { type: Number, default: 0 },
    maxGrade: { type: Number, default: 0 },
    category: { type: String, default: 'Tramo' }, // HC, 1ª Cat, 2ª Cat, 3ª Cat, 4ª Cat, Tramo

    startCoord: { type: [Number], required: true }, // [lng, lat, ele]
    endCoord: { type: [Number], required: true }, // [lng, lat, ele]
    coordinates: { type: [[Number]], required: true }, // [[lng, lat, ele], ...]

    efforts: [SegmentEffortSchema]
  },
  {
    timestamps: true
  }
);

SegmentSchema.index({ sourceActivityId: 1 });

const Segment = mongoose.model('Segment', SegmentSchema);

export default Segment;
