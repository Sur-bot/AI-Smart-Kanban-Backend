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
