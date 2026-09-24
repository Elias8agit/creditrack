const { Router } = require('express');
const reports = require('../services/reportService');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
router.get('/summary', authenticate, authorize('ADMIN', 'ANALISTA'), async (_req, res) => res.json(await reports.summary()));

module.exports = router;
