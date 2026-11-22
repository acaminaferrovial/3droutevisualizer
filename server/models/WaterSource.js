import mongoose from 'mongoose';

const WaterSourceSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Fuente de agua potable', trim: true },
    notes: { type: String, default: '', trim: true },
    lng: { type: Number, required: true },
    lat: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    creatorName: { type: String, default: 'Ciclista' }
  },
  {
    timestamps: true
  }
);

WaterSourceSchema.index({ lng: 1, lat: 1 });

const WaterSource = mongoose.model('WaterSource', WaterSourceSchema);

export default WaterSource;
