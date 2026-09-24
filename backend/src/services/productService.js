const { query } = require('../db/pool');
const { badRequest, notFound } = require('../utils/errors');
const v = require('../utils/validators');
const calc = require('./creditCalculator');

const SELECT = `SELECT id, codigo, nombre, monto_min AS "montoMin", monto_max AS "montoMax",
  plazo_min AS "plazoMin", plazo_max AS "plazoMax", tasa_anual AS "tasaAnual", activo FROM products`;

async function list({ soloActivos = true } = {}) {
  const { rows } = await query(`${SELECT} ${soloActivos ? 'WHERE activo' : ''} ORDER BY id`);
  return rows;
}

async function getById(id) {
  const { rows } = await query(`${SELECT} WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound('Producto no encontrado');
  return rows[0];
}

function validateTerms(product, monto, plazoMeses) {
  const errores = [];
  if (!v.isNumber(monto)) errores.push('El monto debe ser numérico');
  else if (monto < product.montoMin || monto > product.montoMax) {
    errores.push(`El monto debe estar entre Q${product.montoMin} y Q${product.montoMax}`);
  }
  if (!v.isInteger(plazoMeses)) errores.push('El plazo debe ser un número entero de meses');
  else if (plazoMeses < product.plazoMin || plazoMeses > product.plazoMax) {
    errores.push(`El plazo debe estar entre ${product.plazoMin} y ${product.plazoMax} meses`);
  }
  return errores;
}

async function simulate({ productId, monto, plazoMeses }) {
  if (!productId) throw badRequest('El producto es obligatorio');
  const product = await getById(productId);
  if (!product.activo) throw badRequest('El producto no está disponible');
  const errores = validateTerms(product, monto, plazoMeses);
  if (errores.length) throw badRequest('Parámetros de simulación inválidos', errores);
  return { producto: product, monto, plazoMeses, tasaAnual: product.tasaAnual, ...calc.simulate(monto, product.tasaAnual, plazoMeses) };
}

async function update(id, body) {
  const actual = await getById(id);
  const p = { ...actual, ...body };
  const errores = [];
  if (!v.isNonEmptyString(p.nombre, 3, 100)) errores.push('El nombre debe tener entre 3 y 100 caracteres');
  if (!v.isNumber(p.tasaAnual) || p.tasaAnual < 0.01 || p.tasaAnual > 0.6) errores.push('La tasa anual debe estar entre 1 % y 60 %');
  if (!v.isNumber(p.montoMin) || !v.isNumber(p.montoMax) || p.montoMin <= 0 || p.montoMin >= p.montoMax) {
    errores.push('El monto mínimo debe ser positivo y menor que el máximo');
  }
  if (!v.isInteger(p.plazoMin) || !v.isInteger(p.plazoMax) || p.plazoMin < 1 || p.plazoMin > p.plazoMax) {
    errores.push('El plazo mínimo debe ser al menos 1 y no mayor que el máximo');
  }
  if (typeof p.activo !== 'boolean') errores.push('El campo activo debe ser booleano');
  if (errores.length) throw badRequest('Datos de producto inválidos', errores);

  await query(
    `UPDATE products SET nombre=$2, monto_min=$3, monto_max=$4, plazo_min=$5, plazo_max=$6, tasa_anual=$7, activo=$8
     WHERE id=$1`,
    [id, p.nombre.trim(), p.montoMin, p.montoMax, p.plazoMin, p.plazoMax, p.tasaAnual, p.activo],
  );
  return getById(id);
}

module.exports = { list, getById, validateTerms, simulate, update };
