const crypto = require('crypto');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Só aceita string (evita injeção NoSQL via objetos como {"$ne": ""}).
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const int = (v, min, max, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const hash = (v) => crypto.createHash('sha256').update(String(v) + (process.env.IP_SALT || '')).digest('hex').slice(0, 32);

function normEmail(v) {
  const s = str(v, 254);
  return s && EMAIL_RE.test(s) ? s.toLowerCase() : null;
}

// Guarda só dígitos; números BR (10-11 dígitos) ganham o prefixo 55.
function normPhone(v) {
  const s = str(v, 30);
  if (!s) return null;
  let d = s.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 && d.length <= 15 ? d : null;
}

module.exports = { str, int, isDate, hash, normEmail, normPhone };
