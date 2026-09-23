const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const aiController = require('../controllers/aiController');

// Tat ca routes AI yeu cau xac thuc
router.use(authenticate);

// Chat
router.post('/chat', aiController.chat);

// Actions (Confirm / Reject)
router.post('/actions/confirm', aiController.confirmAction);
router.post('/actions/reject', aiController.rejectAction);

// Quota
router.get('/quota', aiController.getQuota);

// Sessions
router.get('/sessions', aiController.getSessions);
router.get('/sessions/:id', aiController.getSession);
router.delete('/sessions/:id', aiController.deleteSession);

module.exports = router;