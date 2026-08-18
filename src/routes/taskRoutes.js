const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireProjectRole } = require('../middleware/permission');
const taskController = require('../controllers/taskController');

// Tất cả route task đều yêu cầu đăng nhập
router.use(authenticate);

// ─── Task CRUD ─────────────────────────────────────────────────────────────
router.post('/bulk-move', requireProjectRole('owner', 'admin', 'member'), taskController.bulkMoveTasks);
router.get('/', taskController.getTasks);
router.post('/', requireProjectRole('owner', 'admin', 'member'), taskController.createTask);
router.get('/:id', requireProjectRole('owner', 'admin', 'member', 'viewer'), taskController.getTaskById);
router.patch('/:id', requireProjectRole('owner', 'admin', 'member'), taskController.updateTask);
router.delete('/:id', requireProjectRole('owner', 'admin'), taskController.deleteTask);

// ─── Relations ──────────────────────────────────────────────────────────────
router.post('/:id/comments', requireProjectRole('owner', 'admin', 'member'), taskController.addComment);
router.post('/:id/checklists', requireProjectRole('owner', 'admin', 'member'), taskController.createChecklist);
router.patch('/checklist-items/:itemId', taskController.toggleChecklistItem);
router.post('/:id/time-logs', requireProjectRole('owner', 'admin', 'member'), taskController.logTime);

module.exports = router;

