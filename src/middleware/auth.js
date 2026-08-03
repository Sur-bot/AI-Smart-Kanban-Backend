const supabase = require('../config/supabase');

/**
 * Middleware xác thực JWT do Supabase Auth cấp phát.
 * Không tự ký, không tự verify bằng JWT_SECRET nữa.
 * Supabase Admin API (service_role) verify token và trả về thông tin user.
 *
 * Hỗ trợ 2 nguồn token:
 *  1. Authorization: Bearer <access_token>   (chuẩn REST / SPA)
 *  2. Cookie: sb-access-token=<token>        (set bởi supabase-js phía client)
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Ưu tiên Authorization header (Bearer)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Fallback sang cookies (supabase-js lưu cookie dạng sb-<project-ref>-auth-token)
    if (!token && req.cookies) {
      // Tìm cookie có tiền tố sb- (Supabase đặt tự động)
      const sbCookieKey = Object.keys(req.cookies).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (sbCookieKey) {
        try {
          const parsed = JSON.parse(req.cookies[sbCookieKey]);
          token = parsed?.access_token || null;
        } catch {
          token = req.cookies[sbCookieKey];
        }
      }
    }

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Bạn cần đăng nhập để thực hiện thao tác này.'
      });
    }

    // 3. Gọi Supabase Auth Admin để verify token — không cần JWT_SECRET
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'InvalidToken',
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'
      });
    }

    // 4. Gắn user vào request để các controller sử dụng
    req.user = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email,
      avatar_url: user.user_metadata?.avatar_url || null,
    };

    next();
  } catch (err) {
    console.error('[Auth Middleware] Lỗi xác thực:', err.message);
    return res.status(500).json({
      error: 'AuthError',
      message: 'Lỗi hệ thống khi xác thực. Vui lòng thử lại.'
    });
  }
};

module.exports = { authenticate };
