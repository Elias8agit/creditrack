const { Pool, types } = require('pg');
const config = require('../config');

// NUMERIC -> number (los montos se manejan con 2 decimales)
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
// DATE -> string 'YYYY-MM-DD' para evitar corrimientos de zona horaria
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
