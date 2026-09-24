// Utilidades de fecha trabajando con cadenas 'YYYY-MM-DD' en UTC

function parseDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== str) return null; // rechaza 2026-02-30
  return d;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function today() {
  return formatDate(new Date());
}

function addMonths(str, months) {
  const d = parseDate(str);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return formatDate(target);
}

function daysBetween(fromStr, toStr) {
  const ms = parseDate(toStr) - parseDate(fromStr);
  return Math.round(ms / 86400000);
}

function ageOn(birthStr, onStr = today()) {
  const b = parseDate(birthStr);
  const o = parseDate(onStr);
  let age = o.getUTCFullYear() - b.getUTCFullYear();
  const m = o.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && o.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

module.exports = { parseDate, formatDate, today, addMonths, daysBetween, ageOn };
