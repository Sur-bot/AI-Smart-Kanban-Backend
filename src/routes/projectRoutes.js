const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireProjectRole } = require('../middleware/permission');
const projectController = require('../controllers/projectController');

// All project routes require authentication
router.use(authenticate);

// -- Project CRUD --------------------------------------------------------------
router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.patch('/:id', requireProjectRole('owner', 'admin'), projectController.updateProject);
router.delete('/:id', requireProjectRole('owner'), projectController.deleteProject);
router.patch('/:id/archive', requireProjectRole('owner', 'admin'), projectController.archiveProject);

// -- Project Statuses ----------------------------------------------------------
router.get('/:id/statuses', requireProjectRole('owner', 'admin', 'member', 'viewer'), projectController.getProjectStatuses);
router.post('/:id/statuses', requireProjectRole('owner', 'admin'), projectController.createProjectStatus);
router.patch('/:id/statuses/:statusId', requireProjectRole('owner', 'admin'), projectController.updateProjectStatus);
router.delete('/:id/statuses/:statusId', requireProjectRole('owner', 'admin'), projectController.deleteProjectStatus);

// -- Labels --------------------------------------------------------------------
router.get('/:id/labels', requireProjectRole('owner', 'admin', 'member', 'viewer'), projectController.getProjectLabels);
router.post('/:id/labels', requireProjectRole('owner', 'admin', 'member'), projectController.createLabel);

// -- Members -------------------------------------------------------------------
router.get('/:id/members', requireProjectRole('owner', 'admin', 'member', 'viewer'), projectController.getProjectMembers);
router.post('/:id/members', requireProjectRole('owner', 'admin'), projectController.addMember);
router.patch('/:id/members/:memberId/job-role', requireProjectRole('owner', 'admin'), projectController.updateMemberJobRole);
router.patch('/:id/members/:memberId/role', requireProjectRole('owner', 'admin'), projectController.updateMemberRole);
router.delete('/:id/members/:memberId', requireProjectRole('owner', 'admin'), projectController.removeMember);
router.post('/:id/members/leave', requireProjectRole('admin', 'member', 'viewer'), projectController.leaveProject);
router.post('/:id/transfer-ownership', requireProjectRole('owner'), projectController.transferOwnership);

// FIX: module.exports must be at the END so ALL routes above are registered
module.exports = router;
