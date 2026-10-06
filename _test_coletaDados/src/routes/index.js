const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Search = require('../models/Search');
const { str, int, isDate, hash, normEmail, normPhone } = require('../util');
const adminAuth = require('../adminAuth');
const { toCsv } = require('../csv');

const router = express.Router();
const limiter = (max) => rateLimit({ windowMs: 15 * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas requisições' } });

// ---------- POST /api/leads ----------
router.post('/leads', limiter(20), async (req, res, next) => {
  try {
    const b = req.body || {};
    const email = normEmail(b.email);
    const phone = normPhone(b.phone);
    if (b.email && !email) return res.status(400).json({ error: 'E-mail inválido' });
    if (b.phone && !phone) return res.status(400).json({ error: 'Telefone inválido' });
    if (!email && !phone) return res.status(400).json({ error: 'Informe e-mail e/ou telefone' });
    if (b.consent !== true) return res.status(400).json({ error: 'É necessário aceitar os termos' });

    const or = [];
    if (email) or.push({ email });
    if (phone) or.push({ phone });

    let lead = await Lead.findOne({ $or: or });
    if (lead) {
      if (email && !lead.email) lead.email = email;
      if (phone && !lead.phone) lead.phone = phone;
      lead.visits += 1;
      lead.lastSeenAt = new Date();
      try { await lead.save(); } catch (e) { if (e.code !== 11000) throw e; }
    } else {
      const utm = (b.utm && typeof b.utm === 'object') ? b.utm : {};
      try {
        lead = await Lead.create({
          email, phone, consent: true, consentAt: new Date(),
          source: {
            utm_source: str(utm.utm_source, 100), utm_medium: str(utm.utm_medium, 100),
            utm_campaign: str(utm.utm_campaign, 100), utm_term: str(utm.utm_term, 100),
            utm_content: str(utm.utm_content, 100),
            referrer: str(b.referrer, 500), landingPath: str(b.landingPath, 300)
          },
          userAgent: str(req.get('user-agent'), 300),
          ipHash: hash(req.ip)
        });
      } catch (e) {
        if (e.code !== 11000) throw e;
        lead = await Lead.findOne({ $or: or }); // corrida entre duas requisições
      }
    }
    res.status(201).json({ leadId: lead._id });
  } catch (err) { next(err); }
});

// ---------- POST /api/searches ----------
const place = (p) => {
  if (!p || typeof p !== 'object') return undefined;
  return { iata: str(p.iata, 3), city: str(p.city, 100), country: str(p.country, 60), name: str(p.name, 150), typed: str(p.typed, 150) };
};

router.post('/searches', limiter(120), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (typeof b.leadId !== 'string' || !mongoose.isValidObjectId(b.leadId)) return res.status(400).json({ error: 'leadId inválido' });
    if (!['flights', 'hotels', 'packages', 'cars'].includes(b.service)) return res.status(400).json({ error: 'Serviço inválido' });
    if (!(await Lead.exists({ _id: b.leadId }))) return res.status(400).json({ error: 'Lead não encontrado' });

    const t = b.travelers || {};
    const car = b.car || {};
    await Search.create({
      lead: b.leadId,
      service: b.service,
      tripType: ['roundtrip', 'oneway'].includes(b.tripType) ? b.tripType : undefined,
      origin: place(b.origin),
      destination: place(b.destination),
      departureDate: isDate(b.departureDate) ? b.departureDate : undefined,
      returnDate: isDate(b.returnDate) ? b.returnDate : undefined,
      travelers: { adults: int(t.adults, 0, 9, 1), children: int(t.children, 0, 9, 0), infants: int(t.infants, 0, 9, 0), rooms: int(t.rooms, 1, 9, 1) },
      directOnly: b.directOnly === true,
      car: b.service === 'cars' ? { differentLocation: car.differentLocation === true, pickupTime: str(car.pickupTime, 5), returnTime: str(car.returnTime, 5) } : undefined,
      redirected: b.redirected !== false,
      redirectUrl: str(b.redirectUrl, 2000),
      userAgent: str(req.get('user-agent'), 300),
      ipHash: hash(req.ip)
    });
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- Admin (Authorization: Bearer ADMIN_TOKEN) ----------
// GET /api/admin/leads?page=1&limit=100&format=csv
// GET /api/admin/searches?page=1&limit=100&format=csv
router.get('/admin/leads', limiter(60), adminAuth, async (req, res, next) => {
  try {
    const limit = int(req.query.limit, 1, 5000, 100);
    const page = int(req.query.page, 1, 100000, 1);
    const [items, total] = await Promise.all([
      Lead.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Lead.countDocuments()
    ]);
    if (req.query.format === 'csv') {
      const rows = items.map((l) => ({
        criado_em: l.createdAt.toISOString(), email: l.email, telefone: l.phone, visitas: l.visits,
        utm_source: l.source?.utm_source, utm_medium: l.source?.utm_medium, utm_campaign: l.source?.utm_campaign,
        referrer: l.source?.referrer
      }));
      return sendCsv(res, 'leads.csv', rows);
    }
    res.json({ total, page, limit, items });
  } catch (err) { next(err); }
});

router.get('/admin/searches', limiter(60), adminAuth, async (req, res, next) => {
  try {
    const limit = int(req.query.limit, 1, 5000, 100);
    const page = int(req.query.page, 1, 100000, 1);
    const [items, total] = await Promise.all([
      Search.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('lead', 'email phone').lean(),
      Search.countDocuments()
    ]);
    if (req.query.format === 'csv') {
      const rows = items.map((s) => ({
        data: s.createdAt.toISOString(), email: s.lead?.email, telefone: s.lead?.phone,
        servico: s.service, tipo_viagem: s.tripType,
        origem_iata: s.origin?.iata, origem_cidade: s.origin?.city,
        destino_iata: s.destination?.iata, destino_cidade: s.destination?.city,
        ida: s.departureDate, volta: s.returnDate,
        adultos: s.travelers?.adults, criancas: s.travelers?.children, bebes: s.travelers?.infants, quartos: s.travelers?.rooms,
        somente_diretos: s.directOnly ? 'sim' : 'nao',
        redirecionado_parceiro: s.redirected === false ? 'nao' : 'sim'
      }));
      return sendCsv(res, 'pesquisas.csv', rows);
    }
    res.json({ total, page, limit, items });
  } catch (err) { next(err); }
});

function sendCsv(res, filename, rows) {
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
  res.send(toCsv(rows));
}

module.exports = router;
