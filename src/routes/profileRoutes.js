const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const profileController = require('../controllers/profileController');

// Tất cả route profile đều yêu cầu đăng nhập
router.use(authenticate);

router.get('/me', profileController.getProfile);
router.patch('/me', profileController.updateProfile);

module.exports = router;
