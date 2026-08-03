const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const projectController = require('../controllers/projectController');

// Tất cả route project đều yêu cầu đăng nhập
router.use(authenticate);

router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/:id/statuses', projectController.getProjectStatuses);

module.exports = router;
