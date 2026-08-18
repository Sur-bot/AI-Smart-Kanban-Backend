const supabase = require('../config/supabase');

/**
 * Middleware kiểm tra quyền trong project.
 * @param {...string} roles - Các role được phép (ví dụ: 'owner', 'admin', 'member')
 */
const requireProjectRole = (...roles) => async (req, res, next) => {
  try {
    const userId = req.user.id;
    let targetProjectId = req.params.projectId || req.query.projectId || req.body.projectId;

    // Nếu không có projectId truyền trực tiếp, thử lấy từ taskId nếu có trong params
    const taskId = req.params.id || req.params.taskId;
    if (!targetProjectId && taskId) {
      const { data, error } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', taskId)
        .single();
      
      if (error || !data) {
        return res.status(404).json({ error: 'Không tìm thấy tác vụ hoặc dự án' });
      }
      targetProjectId = data.project_id;
    }

    if (!targetProjectId) {
      return res.status(400).json({ error: 'Thiếu projectId để kiểm tra quyền' });
    }

    // Lấy role của user trong project
    const { data: member, error } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', targetProjectId)
      .eq('user_id', userId)
      .single();

    if (error || !member) {
      return res.status(403).json({ error: 'Forbidden', message: 'Bạn không có quyền truy cập dự án này' });
    }

    if (!roles.includes(member.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Quyền của bạn không đủ để thực hiện thao tác này' });
    }

    // Lưu role vào request để controller có thể sử dụng
    req.userRole = member.role;
    req.projectId = targetProjectId;
    
    next();
  } catch (error) {
    console.error('[Permission Middleware] Lỗi kiểm tra quyền:', error.message);
    return res.status(500).json({ error: 'Lỗi server khi kiểm tra quyền', details: error.message });
  }
};

module.exports = { requireProjectRole };
