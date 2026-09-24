// Módulo crítico: autenticación y registro
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { query, withTransaction } = require('../db/pool');
const { badRequest, unauthorized, AppError, conflict } = require('../utils/errors');
const v = require('../utils/validators');
const { parseDate, ageOn, today } = require('../utils/dates');

function signToken(user) {
  return jwt.sign({ sub: user.id, rol: user.rol, nombre: user.nombre }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function validateRegistration(body) {
  const errores = [];
  const { nombre, email, password, dpi, fechaNacimiento, ingresoMensual, deudasMensuales = 0, telefono } = body || {};
  if (!v.isNonEmptyString(nombre, 3, 100)) errores.push('El nombre debe tener entre 3 y 100 caracteres');
  if (!v.isEmail(email)) errores.push('El email no tiene un formato válido');
  if (!v.isStrongPassword(password)) {
    errores.push('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un dígito');
  }
  if (!v.isDpi(dpi)) errores.push('El DPI debe tener exactamente 13 dígitos');
  if (!parseDate(fechaNacimiento)) errores.push('La fecha de nacimiento no es válida (YYYY-MM-DD)');
  else if (ageOn(fechaNacimiento, today()) < 18) errores.push('El cliente debe ser mayor de edad');
  if (!v.isNumber(ingresoMensual) || ingresoMensual <= 0) errores.push('El ingreso mensual debe ser mayor que 0');
  if (!v.isNumber(deudasMensuales) || deudasMensuales < 0) errores.push('Las deudas mensuales no pueden ser negativas');
  if (telefono !== undefined && telefono !== null && !/^\d{8}$/.test(String(telefono))) {
    errores.push('El teléfono debe tener 8 dígitos');
  }
  return errores;
}

async function register(body) {
  const errores = validateRegistration(body);
  if (errores.length) throw badRequest('Datos de registro inválidos', errores);

  const email = body.email.trim().toLowerCase();
  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount) throw conflict('El email ya está registrado');
  const dpiExists = await query('SELECT 1 FROM clients WHERE dpi = $1', [body.dpi]);
  if (dpiExists.rowCount) throw conflict('El DPI ya está registrado');

  const hash = await bcrypt.hash(body.password, 10);
  const user = await withTransaction(async (c) => {
    const u = await c.query(
      `INSERT INTO users (nombre, email, password_hash, rol) VALUES ($1,$2,$3,'CLIENTE')
       RETURNING id, nombre, email, rol`,
      [body.nombre.trim(), email, hash],
    );
    await c.query(
      `INSERT INTO clients (user_id, dpi, fecha_nacimiento, ingreso_mensual, deudas_mensuales, telefono)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [u.rows[0].id, body.dpi, body.fechaNacimiento, body.ingresoMensual, body.deudasMensuales || 0, body.telefono || null],
    );
    return u.rows[0];
  });
  return { token: signToken(user), usuario: user };
}

async function login(body) {
  const { email, password } = body || {};
  if (!v.isNonEmptyString(email) || !v.isNonEmptyString(password)) {
    throw badRequest('Email y contraseña son obligatorios');
  }
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
  const user = rows[0];
  if (!user) throw unauthorized('Credenciales inválidas');
  if (!user.activo) throw new AppError(403, 'El usuario está desactivado');
  if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
    throw new AppError(423, 'Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.');
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const intentos = user.intentos_fallidos + 1;
    if (intentos >= config.maxFailedLogins) {
      await query(
        `UPDATE users SET intentos_fallidos = 0,
         bloqueado_hasta = NOW() + ($2 || ' minutes')::interval WHERE id = $1`,
        [user.id, String(config.lockMinutes)],
      );
      throw new AppError(423, 'Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.');
    }
    await query('UPDATE users SET intentos_fallidos = $2 WHERE id = $1', [user.id, intentos]);
    throw unauthorized('Credenciales inválidas');
  }

  await query('UPDATE users SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1', [user.id]);
  const usuario = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
  return { token: signToken(usuario), usuario };
}

async function me(userId) {
  const { rows } = await query(
    `SELECT u.id, u.nombre, u.email, u.rol, c.dpi, c.fecha_nacimiento AS "fechaNacimiento",
            c.ingreso_mensual AS "ingresoMensual", c.deudas_mensuales AS "deudasMensuales", c.telefono
     FROM users u LEFT JOIN clients c ON c.user_id = u.id WHERE u.id = $1`,
    [userId],
  );
  return rows[0];
}

module.exports = { register, login, me, validateRegistration, signToken };
