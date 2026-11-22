import mongoose from 'mongoose';

const PlannedRouteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    title: { type: String, required: true, trim: true },
    sportType: {
      type: String,
      enum: ['Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide'],
      default: 'Ride'
    },
    bikeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gear', default: null },
    bikeName: { type: String, default: '' },
    notes: { type: String, default: '', trim: true },

    distanceMeters: { type: Number, required: true, default: 0 },
    elevationGain: { type: Number, default: 0 },
    elevationLoss: { type: Number, default: 0 },
    estimatedTimeSeconds: { type: Number, default: 0 },
    targetSpeedKmh: { type: Number, default: 25 },
    plannedDate: { type: String, default: '' }, // YYYY-MM-DD opcional
    departureTime: { type: String, default: '09:00' }, // HH:mm opcional
    sourceActivityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', default: null },

    waypoints: { type: [[Number]], default: [] }, // Puntos de control clicados [[lng, lat], ...]
    coordinates: { type: [[Number]], required: true }, // Trazado completo [[lng, lat, ele], ...]
    elevationProfile: [
      {
        distance: { type: Number },
        elevation: { type: Number },
        grade: { type: Number }
      }
    ]
  },
  {
    timestamps: true
  }
);

const PlannedRoute = mongoose.model('PlannedRoute', PlannedRouteSchema);

export default PlannedRoute;
