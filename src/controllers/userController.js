const userService = require('../services/userService');

exports.searchUsers = async (req, res) => {
  try {
    const { q, workspaceId, limit } = req.query;
    const requesterId = req.user.id; // From auth middleware

    if (!q || !workspaceId) {
      return res.status(400).json({ error: 'Missing query (q) or workspaceId' });
    }

    const results = await userService.searchUsersInWorkspace(q, workspaceId, requesterId, parseInt(limit) || 10);
    return res.status(200).json(results);
  } catch (error) {
    console.error('[UserController:searchUsers] Error:', error.message);
    return res.status(500).json({ error: 'Lỗi server khi tìm kiếm người dùng', details: error.message });
  }
};
