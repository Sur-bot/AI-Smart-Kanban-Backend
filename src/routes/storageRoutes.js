const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const storageController = require('../controllers/storageController');

// All storage routes require JWT authentication
router.use(authenticate);

router.get('/quota', storageController.getQuota);
router.post('/check-quota', storageController.checkQuota);
router.get('/files', storageController.getFiles);
router.post('/batch-process', storageController.batchProcessImages);

module.exports = router;
