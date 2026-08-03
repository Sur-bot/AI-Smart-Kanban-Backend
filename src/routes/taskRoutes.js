const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const taskController = require('../controllers/taskController');

// Tất cả route task đều yêu cầu đăng nhập
router.use(authenticate);

// ─── Task CRUD ──────────────────────────────────────────
router.get('/', taskController.getTasks);
router.post('/', taskController.createTask);
router.get('/:id', taskController.getTaskById);
router.patch('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

// ─── Relations ──────────────────────────────────────────
router.post('/:id/comments', taskController.addComment);
router.post('/:id/checklists', taskController.createChecklist);
router.patch('/checklist-items/:itemId', taskController.toggleChecklistItem);
router.post('/:id/time-logs', taskController.logTime);

module.exports = router;
