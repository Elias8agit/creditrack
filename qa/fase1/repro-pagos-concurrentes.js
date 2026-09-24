// Reproduce DEF-05: envía 6 pagos simultáneos sobre el mismo crédito.
// Uso: node repro-pagos-concurrentes.js <idSolicitudDesembolsada> [API]
// Ejemplo: node repro-pagos-concurrentes.js 5 https://creditrack-api.onrender.com/api
const id = process.argv[2];
const API = process.argv[3] || process.env.API || 'http://localhost:3000/api';
if (!id) { console.error('Indique el id de una solicitud DESEMBOLSADA'); process.exit(1); }
const j = async (m, p, t, b) => {
  const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { s: r.status, d: await r.json() };
};
(async () => {
  const token = (await j('POST', '/auth/login', null, { email: 'analista@creditrack.test', password: 'Analista123!' })).d.token;
  const q = (await j('GET', `/applications/${id}/payments/quote`, token)).d;
  console.log(`Cuota pendiente: #${q.cuotaNumero}, total a pagar Q${q.total}`);
  const rs = await Promise.all(Array.from({ length: 6 }, () => j('POST', `/applications/${id}/payments`, token, { monto: q.total })));
  rs.forEach((r, i) => console.log(`Petición ${i + 1}: HTTP ${r.s} -> cuota ${r.d.cuotaNumero ?? r.d.error}`));
  const det = (await j('GET', `/applications/${id}`, token)).d;
  const cnt = {};
  det.planPagos.forEach((c) => { if (c.fechaPago) cnt[c.numero] = (cnt[c.numero] || 0) + 1; });
  const dup = Object.entries(cnt).filter(([, n]) => n > 1);
  console.log(dup.length ? `DEFECTO: cuotas con pagos duplicados -> ${dup.map(([k, n]) => `cuota ${k}: ${n} pagos`).join(', ')}` : 'Sin pagos duplicados');
})();
