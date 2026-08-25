const supabase = require('../config/supabase');

/**
 * Middleware to check project-level role authorization.
 *
 * @param {...string} roles - Allowed roles, e.g. 'owner', 'admin', 'member', 'viewer'
 *
 * Strategy to resolve projectId (in order of priority):
 *   1. req.params.projectId  (route param: /projects/:projectId/...)
 *   2. req.query.projectId   (query string: ?projectId=xxx)
 *   3. req.body?.projectId   (request body — optional chaining to handle GET requests)
 *   4. Fallback: look up project_id from tasks table using req.params.id (taskId)
 */
const requireProjectRole = (...roles) => async (req, res, next) => {
  try {
    const userId = req.user.id;

    // FIX: Use optional chaining on req.body to prevent crash on GET requests
    // where Express 5 may leave req.body as undefined (no body sent)
    let targetProjectId =
      req.params.projectId ||
      req.query.projectId ||
      req.body?.projectId ||
      null;

    // Fallback: if no projectId provided directly, resolve it from the taskId in params
    const taskId = req.params.id || req.params.taskId;
    if (!targetProjectId && taskId) {
      const { data, error } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', taskId)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Task or project not found' });
      }
      targetProjectId = data.project_id;
    }

    if (!targetProjectId) {
      return res.status(400).json({ error: 'Missing projectId for permission check' });
    }

    // Query the member role for this user in the project
    const { data: member, error: memberError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', targetProjectId)
      .eq('user_id', userId)
      .single();

    if (memberError || !member) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this project'
      });
    }

    if (!roles.includes(member.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: [${roles.join(', ')}]. Your role: ${member.role}`
      });
    }

    // Expose role and projectId to downstream controllers
    req.userRole = member.role;
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
