// CSV com ";" (padrão do Excel pt-BR), BOM UTF-8 e proteção contra injeção de fórmulas.
const cell = (v) => {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function toCsv(rows) {
  if (!rows.length) return '\uFEFF';
  const cols = Object.keys(rows[0]);
  return '\uFEFF' + [cols.join(';'), ...rows.map((r) => cols.map((c) => cell(r[c])).join(';'))].join('\r\n');
}

module.exports = { toCsv };
