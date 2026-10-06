const { Schema, model } = require('mongoose');

const leadSchema = new Schema({
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  consent: { type: Boolean, required: true },
  consentAt: Date,
  visits: { type: Number, default: 1 },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  source: {
    utm_source: String, utm_medium: String, utm_campaign: String,
    utm_term: String, utm_content: String,
    referrer: String, landingPath: String
  },
  userAgent: String,
  ipHash: String
}, { timestamps: true });

// Únicos apenas quando o campo existe (permite lead só com e-mail ou só com telefone).
leadSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
leadSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });

module.exports = model('Lead', leadSchema);
