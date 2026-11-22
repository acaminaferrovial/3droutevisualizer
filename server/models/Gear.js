import mongoose from 'mongoose';

const MaintenanceLogSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    odometerKm: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ['drivetrain', 'suspension', 'tires', 'brakes', 'general', 'upgrade', 'other'],
      default: 'general'
    },
    title: { type: String, required: true, trim: true },
    details: { type: String, default: '', trim: true },
    forkSag: { type: Number, default: null },
    forkPsi: { type: Number, default: null },
    shockSag: { type: Number, default: null },
    shockPsi: { type: Number, default: null },
    cost: { type: Number, default: null }
  },
  { timestamps: true }
);

const GearSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['bike', 'shoes', 'other'],
      default: 'bike'
    },
    bikeType: {
      type: String,
      enum: ['Road', 'MTB', 'Gravel', 'EBike', 'TT', 'Other', ''],
      default: 'Road'
    },
    brand: { type: String, default: '', trim: true },
    model: { type: String, default: '', trim: true },
    weightKg: { type: Number, default: null },
    initialDistanceKm: { type: Number, default: 0 },
    maxDistanceKm: { type: Number, default: null },
    notes: { type: String, default: '', trim: true },
    isDefault: { type: Boolean, default: false },
    retired: { type: Boolean, default: false },

    // Configuración de Suspensiones (Horquilla y Amortiguador: SAG %, PSI, modelo, rebote)
    suspension: {
      forkModel: { type: String, default: '', trim: true },
      forkSag: { type: Number, default: null }, // % SAG horquilla (ej: 20)
      forkPsi: { type: Number, default: null }, // PSI horquilla (ej: 78)
      forkRebound: { type: String, default: '', trim: true }, // ej: "-6 clicks"
      shockModel: { type: String, default: '', trim: true },
      shockSag: { type: Number, default: null }, // % SAG amortiguador (ej: 25)
      shockPsi: { type: Number, default: null }, // PSI amortiguador (ej: 165)
      shockRebound: { type: String, default: '', trim: true } // ej: "-5 clicks"
    },

    // Historial de Revisiones y Modificaciones de la bicicleta
    maintenanceLogs: [MaintenanceLogSchema]
  },
  {
    timestamps: true
  }
);

GearSchema.index({ category: 1, isDefault: -1 });

const Gear = mongoose.model('Gear', GearSchema);

export default Gear;
