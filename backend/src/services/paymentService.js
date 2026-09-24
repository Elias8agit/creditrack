// Módulo crítico: registro de pagos y cálculo de recargo por mora
const config = require('../config');
const { query, withTransaction } = require('../db/pool');
const { badRequest, conflict } = require('../utils/errors');
const v = require('../utils/validators');
const { parseDate, today, daysBetween } = require('../utils/dates');
const { round2 } = require('./creditCalculator');
const apps = require('./applicationService');
const { ESTADOS } = require('./stateMachine');

function computeLateFee(cuota, fechaVencimiento, fechaPago) {
  const diasAtraso = Math.max(0, daysBetween(fechaVencimiento, fechaPago));
  const recargo = diasAtraso > config.graceDays ? round2(cuota * config.lateFeeRate) : 0;
  return { diasAtraso, recargo, total: round2(cuota + recargo) };
}

async function nextInstallment(db, applicationId) {
  const { rows } = await db.query(
    `SELECT id, numero, fecha_vencimiento AS "fechaVencimiento", cuota FROM installments
     WHERE application_id = $1 AND estado = 'PENDIENTE' ORDER BY numero LIMIT 1`,
    [applicationId],
  );
  return rows[0];
}

async function quote(user, applicationId, fechaPago = today()) {
  const app = await apps.findById(applicationId);
  if (app.estado !== ESTADOS.DESEMBOLSADA) throw conflict('La solicitud no tiene un crédito desembolsado activo');
  if (!parseDate(fechaPago)) throw badRequest('La fecha de pago no es válida (YYYY-MM-DD)');
  const inst = await nextInstallment({ query }, applicationId);
  return { cuotaNumero: inst.numero, fechaVencimiento: inst.fechaVencimiento, cuota: inst.cuota, ...computeLateFee(inst.cuota, inst.fechaVencimiento, fechaPago) };
}

async function pay(user, applicationId, body) {
  const fechaPago = (body && body.fechaPago) || today();
  const { monto } = body || {};
  if (!parseDate(fechaPago)) throw badRequest('La fecha de pago no es válida (YYYY-MM-DD)');
  if (fechaPago > today()) throw badRequest('La fecha de pago no puede ser futura');
  if (!v.isNumber(monto) || monto <= 0) throw badRequest('El monto debe ser un número positivo');

  const app = await apps.findById(applicationId);
  if (app.estado !== ESTADOS.DESEMBOLSADA) throw conflict('La solicitud no tiene un crédito desembolsado activo');
  if (fechaPago < app.fechaDesembolso) throw badRequest('La fecha de pago no puede ser anterior al desembolso');

  return withTransaction(async (c) => {
    const inst = await nextInstallment(c, applicationId);
    const { diasAtraso, recargo, total } = computeLateFee(inst.cuota, inst.fechaVencimiento, fechaPago);
    if (round2(monto) !== total) {
      throw badRequest(`El monto a pagar para la cuota ${inst.numero} es Q${total.toFixed(2)}`, { cuota: inst.cuota, recargo, total });
    }
    await c.query(`UPDATE installments SET estado = 'PAGADA' WHERE id = $1`, [inst.id]);
    const p = await c.query(
      `INSERT INTO payments (installment_id, fecha_pago, dias_atraso, recargo, monto, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [inst.id, fechaPago, diasAtraso, recargo, total, user.id],
    );
    const pendiente = await nextInstallment(c, applicationId);
    if (!pendiente) {
      await apps.changeState(c, app, ESTADOS.FINALIZADA, user.id, 'Crédito cancelado en su totalidad');
    }
    return { pagoId: p.rows[0].id, cuotaNumero: inst.numero, diasAtraso, recargo, montoPagado: total, estadoSolicitud: app.estado };
  });
}

module.exports = { pay, quote, computeLateFee };
