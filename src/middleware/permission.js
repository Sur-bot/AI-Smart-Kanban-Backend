const supabase = require('../config/supabase');

/**
 * Middleware to check project-level role authorization.
 *
 * @param {...string} roles - Allowed roles, e.g. 'owner', 'admin', 'member', 'viewer'
 */
const requireProjectRole = (...roles) => async (req, res, next) => {
  try {
    const userId = req.user.id;

    let targetProjectId =
      req.params.projectId ||
      req.query.projectId ||
      req.body?.projectId ||
      null;

    const isProjectRoute = req.baseUrl?.includes('projects') || req.originalUrl?.includes('/api/projects');

    if (!targetProjectId && req.params.id) {
      if (isProjectRoute) {
        // Trong route /api/projects/:id/... thì :id chính là projectId
        targetProjectId = req.params.id;
      } else {
        // Trong route /api/tasks/:id/... thì :id là taskId -> truy vấn lấy project_id từ tasks
        const { data, error } = await supabase
          .from('tasks')
          .select('project_id')
          .eq('id', req.params.id)
          .single();

        if (error || !data) {
          return res.status(404).json({ error: 'Task or project not found' });
        }
        targetProjectId = data.project_id;
      }
    } else if (!targetProjectId && req.params.taskId) {
      const { data, error } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', req.params.taskId)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Task or project not found' });
      }
      targetProjectId = data.project_id;
    }

    if (!targetProjectId) {
      return res.status(400).json({ error: 'Missing projectId for permission check' });
    }

    // 1. Kiểm tra nếu user là Owner của project trong bảng projects
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', targetProjectId)
      .single();

    let userRole = null;
    if (project && project.owner_id === userId) {
      userRole = 'owner';
    } else {
      // 2. Kiểm tra role trong project_members
      const { data: member, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', targetProjectId)
        .eq('user_id', userId)
        .single();

      if (!memberError && member) {
        userRole = member.role;
      }
    }

    if (!userRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this project'
      });
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: [${roles.join(', ')}]. Your role: ${userRole}`
      });
    }

    // Expose role and projectId to downstream controllers
    req.userRole = userRole;
    req.projectId = targetProjectId;

    next();
  } catch (error) {
    console.error('[Permission Middleware] Error checking role:', error.message);
    return res.status(500).json({
      error: 'Internal server error during permission check',
      details: error.message
    });
  }
};

module.exports = { requireProjectRole };
