const { Router } = require('express');
const users = require('../services/userService');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/', async (_req, res) => res.json(await users.list()));
router.post('/', async (req, res) => res.status(201).json(await users.createStaff(req.body)));
router.patch('/:id/active', async (req, res) => res.json(await users.setActive(Number(req.params.id), req.body?.activo)));
router.post('/:id/unlock', async (req, res) => res.json(await users.unlock(Number(req.params.id))));

module.exports = router;
