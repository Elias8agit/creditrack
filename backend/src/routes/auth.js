const { Router } = require('express');
const auth = require('../services/authService');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.post('/register', async (req, res) => res.status(201).json(await auth.register(req.body)));
router.post('/login', async (req, res) => res.json(await auth.login(req.body)));
router.get('/me', authenticate, async (req, res) => res.json(await auth.me(req.user.id)));

module.exports = router;
