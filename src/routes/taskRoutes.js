const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireProjectRole } = require('../middleware/permission');
const taskController = require('../controllers/taskController');

// All task routes require authentication
router.use(authenticate);

// -- Task CRUD -----------------------------------------------------------------
router.post('/bulk-move', requireProjectRole('owner', 'admin', 'member'), taskController.bulkMoveTasks);
router.get('/', taskController.getTasks);
router.post('/', requireProjectRole('owner', 'admin', 'member'), taskController.createTask);
router.get('/:id', requireProjectRole('owner', 'admin', 'member', 'viewer'), taskController.getTaskById);
router.patch('/:id', requireProjectRole('owner', 'admin', 'member'), taskController.updateTask);
router.delete('/:id', requireProjectRole('owner', 'admin'), taskController.deleteTask);

// -- Relations ----------------------------------------------------------------
router.post('/:id/comments', requireProjectRole('owner', 'admin', 'member'), taskController.addComment);
router.post('/:id/checklists', requireProjectRole('owner', 'admin', 'member'), taskController.createChecklist);
// FIX: Added requireProjectRole - previously anyone authenticated could toggle checklist items
router.patch('/checklist-items/:itemId', requireProjectRole('owner', 'admin', 'member'), taskController.toggleChecklistItem);
router.post('/:id/time-logs', requireProjectRole('owner', 'admin', 'member'), taskController.logTime);

// -- Sub-resources -------------------------------------------------------------
// FIX: Moved from after module.exports — these routes were previously dead (never registered)
router.get('/:id/subtasks', requireProjectRole('owner', 'admin', 'member', 'viewer'), taskController.getSubtasks);
router.post('/:id/subtasks', requireProjectRole('owner', 'admin', 'member'), taskController.createSubtask);

router.get('/:id/activities', requireProjectRole('owner', 'admin', 'member', 'viewer'), taskController.getTaskActivities);

router.post('/:id/attachments', requireProjectRole('owner', 'admin', 'member'), taskController.addAttachment);

// FIX: module.exports must be at the END so ALL routes above are registered
module.exports = router;
