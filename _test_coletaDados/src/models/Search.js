const { Schema, model } = require('mongoose');

const place = new Schema({
  iata: String, city: String, country: String, name: String,
  typed: String // texto digitado pelo usuário
}, { _id: false });

const searchSchema = new Schema({
  lead: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  service: { type: String, enum: ['flights', 'hotels', 'packages', 'cars'], required: true },
  tripType: { type: String, enum: ['roundtrip', 'oneway'] },
  origin: place,
  destination: place,
  departureDate: String, // YYYY-MM-DD
  returnDate: String,
  travelers: { adults: Number, children: Number, infants: Number, rooms: Number },
  directOnly: Boolean,
  car: { differentLocation: Boolean, pickupTime: String, returnTime: String },
  redirectUrl: String, // URL do parceiro para onde o usuário foi enviado
  userAgent: String,
  ipHash: String
}, { timestamps: { createdAt: true, updatedAt: false } });

searchSchema.index({ createdAt: -1 });
searchSchema.index({ 'destination.iata': 1 });

module.exports = model('Search', searchSchema);
