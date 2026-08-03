const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Đăng ký
router.post('/register', authController.register);

// Xác minh email
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// Đăng nhập
router.post('/login', authController.login);

// Đăng xuất
router.post('/logout', authController.logout);

// Refresh token
router.post('/refresh', authController.refresh);

module.exports = router;
