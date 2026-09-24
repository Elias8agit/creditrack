const { Router } = require('express');
const products = require('../services/productService');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// Público: catálogo de productos activos y simulador
router.get('/', async (_req, res) => res.json(await products.list({ soloActivos: true })));
router.post('/simulate', async (req, res) => res.json(await products.simulate(req.body || {})));

// Administración
router.get('/admin/all', authenticate, authorize('ADMIN'), async (_req, res) =>
  res.json(await products.list({ soloActivos: false })));
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) =>
  res.json(await products.update(Number(req.params.id), req.body || {})));

module.exports = router;
