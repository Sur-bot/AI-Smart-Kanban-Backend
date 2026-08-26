const projectService = require('../services/projectService');

exports.getProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.query;
    const projects = await projectService.getUserProjects(userId, workspaceId);
    return res.status(200).json(projects);
  } catch (error) {
    console.error('[ProjectController:getProjects] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi lấy danh sách dự án', details: error.message });
  }
};

exports.createProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên dự án không được để trống' });
    }
    const project = await projectService.createProject(req.body, userId);
    return res.status(201).json(project);
  } catch (error) {
    console.error('[ProjectController:createProject] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi tạo dự án', details: error.message });
  }
};

exports.getProjectStatuses = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const statuses = await projectService.getProjectStatuses(projectId);
    return res.status(200).json(statuses);
  } catch (error) {
    console.error('[ProjectController:getProjectStatuses] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi lấy danh sách trạng thái', details: error.message });
  }
};

exports.getProjectLabels = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const labels = await projectService.getProjectLabels(projectId);
    return res.status(200).json(labels);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server khi lấy labels', details: error.message });
  }
};

exports.createLabel = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const label = await projectService.createLabel(projectId, req.body);
    return res.status(201).json(label);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server khi tạo label', details: error.message });
  }
};

exports.getProjectMembers = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const members = await projectService.getProjectMembers(projectId);
    return res.status(200).json(members);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server khi lấy thành viên', details: error.message });
  }
};

exports.createProjectStatus = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const status = await projectService.createProjectStatus(projectId, req.body);
    return res.status(201).json(status);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server khi tạo status', details: error.message });
  }
};

exports.updateProjectStatus = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { statusId } = req.params;
    const status = await projectService.updateProjectStatus(projectId, statusId, req.body);
    return res.status(200).json(status);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server khi cập nhật status', details: error.message });
  }
};

exports.deleteProjectStatus = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const { statusId } = req.params;
    const { newStatusId } = req.body;
    await projectService.deleteProjectStatus(projectId, statusId, newStatusId);
    return res.status(200).json({ success: true, message: 'Đã xóa cột thành công' });
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server khi xóa status', details: error.message });
  }
};

exports.addMember = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { userId, role, jobRole } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId la bat buoc' });
    }
    const member = await projectService.addMemberToProject(projectId, { userId, role, jobRole });
    return res.status(201).json(member);
  } catch (error) {
    console.error('[ProjectController:addMember] Error:', error);
    return res.status(500).json({ error: 'Loi server khi them thanh vien', details: error.message });
  }
};

exports.updateMemberJobRole = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { memberId } = req.params;
    const { jobRole } = req.body;
    const member = await projectService.updateMemberJobRole(projectId, memberId, jobRole ?? null);
    return res.status(200).json(member);
  } catch (error) {
    console.error('[ProjectController:updateMemberJobRole] Error:', error);
    return res.status(500).json({ error: 'Loi server khi cap nhat job_role', details: error.message });
  }
};


// -- Project Management --------------------------------------------------------

exports.updateProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await projectService.updateProject(projectId, req.body);
    return res.status(200).json(project);
  } catch (error) {
    console.error('[ProjectController:updateProject] Error:', error);
    return res.status(500).json({ error: 'Error updating project', details: error.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    await projectService.deleteProject(projectId);
    return res.status(200).json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('[ProjectController:deleteProject] Error:', error);
    return res.status(500).json({ error: 'Error deleting project', details: error.message });
  }
};

exports.archiveProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { archive = true } = req.body;
    const project = await projectService.archiveProject(projectId, archive);
    return res.status(200).json(project);
  } catch (error) {
    console.error('[ProjectController:archiveProject] Error:', error);
    return res.status(500).json({ error: 'Error archiving project', details: error.message });
  }
};

// -- Member Management ---------------------------------------------------------

exports.updateMemberRole = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { memberId } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required' });
    const member = await projectService.updateMemberRole(projectId, memberId, role, req.userRole);
    return res.status(200).json(member);
  } catch (error) {
    const statusCode = error.message.includes('cannot') || error.message.includes('Cannot') ? 403 : 500;
    console.error('[ProjectController:updateMemberRole] Error:', error);
    return res.status(statusCode).json({ error: error.message });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { memberId } = req.params;
    const result = await projectService.removeMember(projectId, memberId, req.userRole);
    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.message.includes('cannot') || error.message.includes('Cannot') ? 403 : 500;
    console.error('[ProjectController:removeMember] Error:', error);
    return res.status(statusCode).json({ error: error.message });
  }
};

exports.leaveProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;
    const result = await projectService.leaveProject(projectId, userId);
    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.message.includes('cannot') || error.message.includes('Cannot') ? 403 : 500;
    console.error('[ProjectController:leaveProject] Error:', error);
    return res.status(statusCode).json({ error: error.message });
  }
};

exports.transferOwnership = async (req, res) => {
  try {
    const projectId = req.params.id;
    const currentOwnerUserId = req.user.id;
    const { newOwnerUserId } = req.body;
    if (!newOwnerUserId) return res.status(400).json({ error: 'newOwnerUserId is required' });
    const result = await projectService.transferOwnership(projectId, newOwnerUserId, currentOwnerUserId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[ProjectController:transferOwnership] Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
