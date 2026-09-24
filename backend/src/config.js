require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/creditrack',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '60m',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  seedOnStart: process.env.SEED_ON_START !== 'false',
  maxFailedLogins: 5,
  lockMinutes: 15,
  maxActiveApplications: 3,
  adminApprovalThreshold: 100000,
  graceDays: 5,
  lateFeeRate: 0.05,
};

module.exports = config;
