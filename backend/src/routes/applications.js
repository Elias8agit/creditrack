const { Router } = require('express');
const apps = require('../services/applicationService');
const payments = require('../services/paymentService');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

const id = (req) => Number(req.params.id);

router.get('/', async (req, res) => res.json(await apps.list(req.user, { estado: req.query.estado })));
router.post('/', authorize('CLIENTE'), async (req, res) => res.status(201).json(await apps.create(req.user, req.body)));
router.get('/:id', async (req, res) => res.json(await apps.getDetail(req.user, id(req))));
router.put('/:id', authorize('CLIENTE'), async (req, res) => res.json(await apps.update(req.user, id(req), req.body || {})));
router.post('/:id/submit', authorize('CLIENTE'), async (req, res) => res.json(await apps.submit(req.user, id(req))));
router.post('/:id/cancel', authorize('CLIENTE'), async (req, res) => res.json(await apps.cancel(req.user, id(req))));
router.post('/:id/evaluate', authorize('ANALISTA', 'ADMIN'), async (req, res) =>
  res.json(await apps.evaluate(req.user, id(req), req.body)));
router.post('/:id/disburse', authorize('ADMIN'), async (req, res) =>
  res.json(await apps.disburse(req.user, id(req), req.body)));
router.get('/:id/payments/quote', authorize('ANALISTA', 'ADMIN'), async (req, res) =>
  res.json(await payments.quote(req.user, id(req), req.query.fechaPago)));
router.post('/:id/payments', authorize('ANALISTA', 'ADMIN'), async (req, res) =>
  res.status(201).json(await payments.pay(req.user, id(req), req.body)));

module.exports = router;
