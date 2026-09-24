const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', servicio: 'creditrack-api', fecha: new Date().toISOString() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
