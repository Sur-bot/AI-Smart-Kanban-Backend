const supabase = require('../config/supabase');

/**
 * Lấy thông tin profile của user hiện tại
 * Auth (đăng ký, đăng nhập, đăng xuất, refresh token) được xử lý hoàn toàn
 * bởi Supabase Auth phía Frontend (supabase-js). Backend không cần can thiệp.
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy metadata bổ sung từ auth.users nếu cần
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);

    if (error || !user) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin người dùng' });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email,
      avatar_url: user.user_metadata?.avatar_url || null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    });
  } catch (error) {
    console.error('[ProfileController] Error:', error.message);
    return res.status(500).json({ error: 'Lỗi server nội bộ' });
  }
};

/**
 * Cập nhật thông tin profile (tên, avatar)
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, avatarUrl } = req.body;

    const updateData = { data: {} };
    if (fullName) updateData.data.full_name = fullName;
    if (avatarUrl) updateData.data.avatar_url = avatarUrl;

    const { data: { user }, error } = await supabase.auth.admin.updateUserById(userId, updateData);

    if (error) throw error;

    return res.status(200).json({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name,
      avatar_url: user.user_metadata?.avatar_url,
    });
  } catch (error) {
    console.error('[ProfileController:updateProfile] Error:', error.message);
    return res.status(500).json({ error: 'Lỗi server khi cập nhật profile' });
  }
};
