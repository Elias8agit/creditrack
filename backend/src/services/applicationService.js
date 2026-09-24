// Módulo crítico: gestión del ciclo de vida de la solicitud de crédito
const config = require('../config');
const { query, withTransaction } = require('../db/pool');
const { badRequest, forbidden, notFound, conflict } = require('../utils/errors');
const v = require('../utils/validators');
const { parseDate, today, ageOn } = require('../utils/dates');
const products = require('./productService');
const calc = require('./creditCalculator');
const engine = require('./evaluationEngine');
const buro = require('./buroClient');
const { ESTADOS, ACTIVOS, EDITABLES, canTransition } = require('./stateMachine');

const SELECT = `SELECT a.id, a.client_id AS "clientId", u.nombre AS "cliente", a.product_id AS "productId",
  p.codigo AS "productoCodigo", p.nombre AS "producto", a.monto, a.plazo_meses AS "plazoMeses",
  a.tasa_anual AS "tasaAnual", a.cuota, a.destino, a.estado, a.score, a.mora_activa AS "moraActiva",
  a.rdi, a.recomendacion, a.motivo_rechazo AS "motivoRechazo", a.fecha_desembolso AS "fechaDesembolso",
  a.creado_en AS "creadoEn", a.actualizado_en AS "actualizadoEn"
  FROM applications a JOIN users u ON u.id = a.client_id JOIN products p ON p.id = a.product_id`;

async function findById(id, db = { query }) {
  const { rows } = await db.query(`${SELECT} WHERE a.id = $1`, [id]);
  if (!rows[0]) throw notFound('Solicitud no encontrada');
  return rows[0];
}

function assertAccess(user, app) {
  if (user.rol === 'CLIENTE' && app.clientId !== user.id) throw notFound('Solicitud no encontrada');
}

function assertOwner(user, app) {
  if (user.rol !== 'CLIENTE' || app.clientId !== user.id) throw forbidden('Solo el cliente titular puede realizar esta acción');
}

async function changeState(db, app, to, userId, comentario, extra = {}) {
  if (!canTransition(app.estado, to)) {
    throw conflict(`Transición no permitida: ${app.estado} → ${to}`);
  }
  const sets = ['estado = $2', 'actualizado_en = NOW()'];
  const params = [app.id, to];
  Object.entries(extra).forEach(([col, val]) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  });
  await db.query(`UPDATE applications SET ${sets.join(', ')} WHERE id = $1`, params);
  await db.query(
    `INSERT INTO application_history (application_id, estado_anterior, estado_nuevo, usuario_id, comentario)
     VALUES ($1,$2,$3,$4,$5)`,
    [app.id, app.estado, to, userId, comentario || null],
  );
  app.estado = to;
}

function validateDestino(destino) {
  return v.isNonEmptyString(destino, 10, 200) ? [] : ['El destino debe tener entre 10 y 200 caracteres'];
}

async function list(user, { estado } = {}) {
  const params = [];
  const where = [];
  if (user.rol === 'CLIENTE') {
    params.push(user.id);
    where.push(`a.client_id = $${params.length}`);
  }
  if (estado) {
    params.push(estado);
    where.push(`a.estado = $${params.length}`);
  }
  const { rows } = await query(
    `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.creado_en DESC`,
    params,
  );
  return rows;
}

async function getDetail(user, id) {
  const app = await findById(id);
  assertAccess(user, app);
  const hist = await query(
    `SELECT h.estado_anterior AS "estadoAnterior", h.estado_nuevo AS "estadoNuevo", h.comentario,
            h.creado_en AS "fecha", u.nombre AS "usuario"
     FROM application_history h LEFT JOIN users u ON u.id = h.usuario_id
     WHERE h.application_id = $1 ORDER BY h.id`,
    [id],
  );
  const cuotas = await query(
    `SELECT i.id, i.numero, i.fecha_vencimiento AS "fechaVencimiento", i.capital, i.interes, i.cuota, i.saldo, i.estado,
            p.fecha_pago AS "fechaPago", p.recargo, p.monto AS "montoPagado"
     FROM installments i LEFT JOIN payments p ON p.installment_id = i.id
     WHERE i.application_id = $1 ORDER BY i.numero`,
    [id],
  );
  return { ...app, historial: hist.rows, planPagos: cuotas.rows };
}

async function create(user, body) {
  const { productId, monto, plazoMeses, destino } = body || {};
  if (!productId) throw badRequest('El producto es obligatorio');
  const product = await products.getById(productId);
  if (!product.activo) throw badRequest('El producto no está disponible');
  const errores = [...products.validateTerms(product, monto, plazoMeses), ...validateDestino(destino)];
  if (errores.length) throw badRequest('Datos de solicitud inválidos', errores);

  const activas = await query(
    'SELECT COUNT(*)::int AS n FROM applications WHERE client_id = $1 AND estado = ANY($2)',
    [user.id, ACTIVOS],
  );
  if (activas.rows[0].n >= config.maxActiveApplications) {
    throw conflict(`No puede tener más de ${config.maxActiveApplications} solicitudes activas`);
  }

  const cuota = calc.monthlyPayment(monto, product.tasaAnual, plazoMeses);
  const id = await withTransaction(async (c) => {
    const r = await c.query(
      `INSERT INTO applications (client_id, product_id, monto, plazo_meses, tasa_anual, cuota, destino, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'BORRADOR') RETURNING id`,
      [user.id, product.id, monto, plazoMeses, product.tasaAnual, cuota, destino.trim()],
    );
    await c.query(
      `INSERT INTO application_history (application_id, estado_anterior, estado_nuevo, usuario_id, comentario)
       VALUES ($1, NULL, 'BORRADOR', $2, 'Solicitud creada')`,
      [r.rows[0].id, user.id],
    );
    return r.rows[0].id;
  });
  return findById(id);
}

async function update(user, id, body) {
  const app = await findById(id);
  assertAccess(user, app);
  assertOwner(user, app);
  if (!EDITABLES.includes(app.estado)) throw conflict(`No se puede editar una solicitud en estado ${app.estado}`);

  const productId = body.productId ?? app.productId;
  const monto = body.monto ?? app.monto;
  const plazoMeses = body.plazoMeses ?? app.plazoMeses;
  const destino = body.destino ?? app.destino;
  const product = await products.getById(productId);
  const errores = [...products.validateTerms(product, monto, plazoMeses), ...validateDestino(destino)];
  if (errores.length) throw badRequest('Datos de solicitud inválidos', errores);

  const cuota = calc.monthlyPayment(monto, product.tasaAnual, plazoMeses);
  await query(
    `UPDATE applications SET product_id=$2, monto=$3, plazo_meses=$4, tasa_anual=$5, cuota=$6, destino=$7,
     actualizado_en = NOW() WHERE id=$1`,
    [id, product.id, monto, plazoMeses, product.tasaAnual, cuota, destino.trim()],
  );
  return findById(id);
}

async function submit(user, id) {
  const app = await findById(id);
  assertAccess(user, app);
  assertOwner(user, app);

  const cli = await query('SELECT * FROM clients WHERE user_id = $1', [app.clientId]);
  const cliente = cli.rows[0];

  return withTransaction(async (c) => {
    await changeState(c, app, ESTADOS.ENVIADA, user.id, 'Solicitud enviada por el cliente');

    const reporte = await buro.consult(cliente.dpi);
    const rdi = engine.computeRdi(cliente.deudas_mensuales, app.cuota, cliente.ingreso_mensual);
    const edadActual = ageOn(cliente.fecha_nacimiento, today());
    const r = engine.evaluate({
      score: reporte.score,
      moraActiva: reporte.moraActiva,
      rdi,
      edadActual,
      plazoMeses: app.plazoMeses,
    });

    const extra = {
      score: reporte.score,
      mora_activa: reporte.moraActiva,
      rdi: Math.round(rdi * 10000) / 10000,
      recomendacion: r.recomendacion || null,
      motivo_rechazo: r.motivo || null,
    };
    const comentario = r.resultado === 'RECHAZADA'
      ? `Rechazo automático (${r.regla}): ${r.motivo}`
      : `Pre-evaluación (${r.regla}): ${r.recomendacion}`;
    await changeState(c, app, r.resultado, null, comentario, extra);
    return findById(id, c);
  });
}

async function cancel(user, id) {
  const app = await findById(id);
  assertAccess(user, app);
  assertOwner(user, app);
  await withTransaction((c) => changeState(c, app, ESTADOS.CANCELADA, user.id, 'Cancelada por el cliente'));
  return findById(id);
}

const DECISIONES = { APROBAR: ESTADOS.APROBADA, RECHAZAR: ESTADOS.RECHAZADA, DEVOLVER: ESTADOS.DEVUELTA };

async function evaluate(user, id, body) {
  const { decision, comentario } = body || {};
  const destino = DECISIONES[decision];
  if (!destino) throw badRequest('La decisión debe ser APROBAR, RECHAZAR o DEVOLVER');
  if (decision !== 'APROBAR' && !v.isNonEmptyString(comentario, 10, 500)) {
    throw badRequest('El comentario es obligatorio (mínimo 10 caracteres) para rechazar o devolver');
  }
  const app = await findById(id);
  if (app.estado !== ESTADOS.EN_REVISION) {
    throw conflict(`Transición no permitida: ${app.estado} → ${destino}`);
  }
  if (decision === 'APROBAR' && app.monto > config.adminApprovalThreshold && user.rol !== 'ADMIN') {
    throw forbidden(`Montos mayores a Q${config.adminApprovalThreshold} requieren aprobación de un administrador`);
  }
  const extra = decision === 'RECHAZAR' ? { motivo_rechazo: 'DECISION_ANALISTA' } : {};
  await withTransaction((c) => changeState(c, app, destino, user.id, comentario, extra));
  return findById(id);
}

async function disburse(user, id, body) {
  const fecha = (body && body.fechaDesembolso) || today();
  if (!parseDate(fecha)) throw badRequest('La fecha de desembolso no es válida (YYYY-MM-DD)');
  if (fecha > today()) throw badRequest('La fecha de desembolso no puede ser futura');

  const app = await findById(id);
  const tabla = calc.amortizationSchedule(app.monto, app.tasaAnual, app.plazoMeses, fecha);
  await withTransaction(async (c) => {
    await changeState(c, app, ESTADOS.DESEMBOLSADA, user.id, `Desembolso con fecha ${fecha}`, { fecha_desembolso: fecha });
    for (const row of tabla) {
      await c.query(
        `INSERT INTO installments (application_id, numero, fecha_vencimiento, capital, interes, cuota, saldo)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [app.id, row.numero, row.fechaVencimiento, row.capital, row.interes, row.cuota, row.saldo],
      );
    }
  });
  return getDetail(user, id);
}

module.exports = { list, getDetail, create, update, submit, cancel, evaluate, disburse, changeState, findById };
