const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const aiController = require('../controllers/aiController');

const rateLimit = require('express-rate-limit');

const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phut
  max: 5, // Gioi han 5 requests moi phut moi user
  message: { error: 'TooManyRequests', message: 'Ban thao tac qua nhanh. Vui long doi mot lat roi thu lai.' },
  keyGenerator: (req) => req.user.id
});

// Tat ca routes AI yeu cau xac thuc
router.use(authenticate);

// Chat
router.post('/chat', chatRateLimiter, aiController.chat);

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
