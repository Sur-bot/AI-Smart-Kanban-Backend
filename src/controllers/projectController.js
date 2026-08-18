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
