import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    bio: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    primarySport: {
      type: String,
      enum: ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide', 'Run', 'TrailRun', 'Hike'],
      default: 'Ride'
    },
    weightKg: { type: Number, default: null },
    ftpWatts: { type: Number, default: null },
    maxHeartrate: { type: Number, default: null },
    restingHeartrate: { type: Number, default: null },
    garminApiKeyHash: { type: String, default: null, index: true },
    garminApiKeyPrefix: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model('User', UserSchema);

export default User;
