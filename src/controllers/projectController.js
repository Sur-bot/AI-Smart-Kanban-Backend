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
