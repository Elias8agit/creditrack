const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { badRequest, conflict, notFound } = require('../utils/errors');
const v = require('../utils/validators');

async function list() {
  const { rows } = await query(
    `SELECT id, nombre, email, rol, activo, intentos_fallidos AS "intentosFallidos",
            bloqueado_hasta AS "bloqueadoHasta", creado_en AS "creadoEn"
     FROM users ORDER BY id`,
  );
  return rows;
}

async function createStaff(body) {
  const { nombre, email, password, rol = 'ANALISTA' } = body || {};
  const errores = [];
  if (!v.isNonEmptyString(nombre, 3, 100)) errores.push('El nombre debe tener entre 3 y 100 caracteres');
  if (!v.isEmail(email)) errores.push('El email no tiene un formato válido');
  if (!v.isStrongPassword(password)) {
    errores.push('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un dígito');
  }
  if (!['ANALISTA', 'ADMIN'].includes(rol)) errores.push('El rol debe ser ANALISTA o ADMIN');
  if (errores.length) throw badRequest('Datos de usuario inválidos', errores);

  const normalized = email.trim().toLowerCase();
  const exists = await query('SELECT 1 FROM users WHERE email = $1', [normalized]);
  if (exists.rowCount) throw conflict('El email ya está registrado');
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (nombre, email, password_hash, rol) VALUES ($1,$2,$3,$4)
     RETURNING id, nombre, email, rol, activo`,
    [nombre.trim(), normalized, hash, rol],
  );
  return rows[0];
}

async function setActive(id, activo) {
  if (typeof activo !== 'boolean') throw badRequest('El campo activo debe ser booleano');
  const { rows } = await query(
    'UPDATE users SET activo = $2 WHERE id = $1 RETURNING id, nombre, email, rol, activo',
    [id, activo],
  );
  if (!rows[0]) throw notFound('Usuario no encontrado');
  return rows[0];
}

async function unlock(id) {
  const { rows } = await query(
    `UPDATE users SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1
     RETURNING id, nombre, email, rol, activo`,
    [id],
  );
  if (!rows[0]) throw notFound('Usuario no encontrado');
  return rows[0];
}

module.exports = { list, createStaff, setActive, unlock };
