const express = require('express');
const { login, getMe } = require('../controllers/authController');
const { authRequired } = require('../../../../web/middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.get('/me', authRequired, getMe);

module.exports = router;

