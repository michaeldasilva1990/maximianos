const crypto = require('crypto');

module.exports = function adminAuth(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: 'ADMIN_TOKEN não configurado' });
  const given = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Não autorizado' });
  next();
};
