const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const storageController = require('../controllers/storageController');

// Tất cả route storage đều yêu cầu xác thực JWT
router.use(authenticate);

router.get('/quota', storageController.getQuota);
router.post('/check-quota', storageController.checkQuota);
router.get('/files', storageController.getFiles);

module.exports = router;