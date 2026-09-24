const { query } = require('../db/pool');
const { today } = require('../utils/dates');

async function summary() {
  const porEstado = await query(
    'SELECT estado, COUNT(*)::int AS cantidad, COALESCE(SUM(monto),0)::float AS monto FROM applications GROUP BY estado ORDER BY estado',
  );
  const totals = Object.fromEntries(porEstado.rows.map((r) => [r.estado, r]));
  const aprobadas = ['APROBADA', 'DESEMBOLSADA', 'FINALIZADA'].reduce((a, e) => a + (totals[e]?.cantidad || 0), 0);
  const rechazadas = totals.RECHAZADA?.cantidad || 0;
  const decididas = aprobadas + rechazadas;

  const vencidas = await query(
    `SELECT COUNT(*)::int AS cantidad, COALESCE(SUM(cuota),0)::float AS monto
     FROM installments WHERE estado = 'PENDIENTE' AND fecha_vencimiento < $1`,
    [today()],
  );

  return {
    porEstado: porEstado.rows,
    montoAprobado: ['APROBADA', 'DESEMBOLSADA', 'FINALIZADA'].reduce((a, e) => a + (totals[e]?.monto || 0), 0),
    montoDesembolsado: ['DESEMBOLSADA', 'FINALIZADA'].reduce((a, e) => a + (totals[e]?.monto || 0), 0),
    tasaAprobacion: decididas ? Math.round((aprobadas / decididas) * 10000) / 100 : 0,
    cuotasVencidas: vencidas.rows[0],
  };
}

module.exports = { summary };
