const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query } = require('./pool');

const PRODUCTS = [
  ['MICRO', 'Microcrédito', 1000, 25000, 3, 24, 0.24],
  ['PERSONAL', 'Préstamo personal', 5000, 150000, 6, 60, 0.18],
  ['VEHICULO', 'Crédito vehicular', 25000, 400000, 12, 72, 0.12],
];

// Clientes semilla: el DPI determina la respuesta del buró simulado (ver services/buroClient.js)
const CLIENTS = [
  ['Ana López', 'ana@creditrack.test', '1000000000101', '1990-05-10', 12000, 1000],
  ['Bruno Pérez', 'bruno@creditrack.test', '1000000000202', '1985-08-21', 8000, 500],
  ['Carla Méndez', 'carla@creditrack.test', '1000000000303', '1992-01-30', 9000, 0],
  ['Diego Ruiz', 'diego@creditrack.test', '1000000000404', '1988-11-02', 15000, 2000],
  ['Elena Castillo', 'elena@creditrack.test', '1000000000505', '1966-03-15', 10000, 0],
  ['Fabio Morales', 'fabio@creditrack.test', '1000000000606', '1995-07-07', 7000, 800],
];

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
}

async function seed() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) return false;

  for (const p of PRODUCTS) {
    await query(
      `INSERT INTO products (codigo, nombre, monto_min, monto_max, plazo_min, plazo_max, tasa_anual)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      p,
    );
  }

  const adminHash = await bcrypt.hash('Admin123!', 10);
  const analistaHash = await bcrypt.hash('Analista123!', 10);
  const clienteHash = await bcrypt.hash('Cliente123!', 10);

  await query(
    `INSERT INTO users (nombre, email, password_hash, rol) VALUES
     ('Administrador General', 'admin@creditrack.test', $1, 'ADMIN'),
     ('Laura Analista', 'analista@creditrack.test', $2, 'ANALISTA')`,
    [adminHash, analistaHash],
  );

  for (const [nombre, email, dpi, nac, ingreso, deudas] of CLIENTS) {
    const u = await query(
      `INSERT INTO users (nombre, email, password_hash, rol) VALUES ($1,$2,$3,'CLIENTE') RETURNING id`,
      [nombre, email, clienteHash],
    );
    await query(
      `INSERT INTO clients (user_id, dpi, fecha_nacimiento, ingreso_mensual, deudas_mensuales)
       VALUES ($1,$2,$3,$4,$5)`,
      [u.rows[0].id, dpi, nac, ingreso, deudas],
    );
  }
  return true;
}

async function reset() {
  await query(`DROP TABLE IF EXISTS payments, installments, application_history, applications,
               products, clients, users CASCADE`);
  await migrate();
  await seed();
}

module.exports = { migrate, seed, reset };
