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


const { requireProjectRole } = require('../middleware/permission');
router.get('/:id/labels', requireProjectRole('owner', 'admin', 'member', 'viewer'), projectController.getProjectLabels);
router.post('/:id/labels', requireProjectRole('owner', 'admin', 'member'), projectController.createLabel);



router.get('/:id/members', requireProjectRole('owner', 'admin', 'member', 'viewer'), projectController.getProjectMembers);
router.post('/:id/members', requireProjectRole('owner', 'admin'), projectController.addMember);
router.patch('/:id/members/:memberId', requireProjectRole('owner', 'admin'), projectController.updateMemberJobRole);



router.post('/:id/statuses', requireProjectRole('owner', 'admin'), projectController.createProjectStatus);
router.patch('/:id/statuses/:statusId', requireProjectRole('owner', 'admin'), projectController.updateProjectStatus);
router.delete('/:id/statuses/:statusId', requireProjectRole('owner', 'admin'), projectController.deleteProjectStatus);

