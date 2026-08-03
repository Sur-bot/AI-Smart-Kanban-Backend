const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_for_development_only';

/**
 * Middleware xác thực JWT (hỗ trợ cả Bearer Token lẫn HTTP-only Cookie)
 */
const authenticate = (req, res, next) => {
  try {
    let token = null;

    // 1. Kiểm tra Authorization Header (Bearer token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // 2. Fallback sang cookie
    else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Bạn cần đăng nhập để thực hiện thao tác này (Thiếu token).'
      });
    }

    // 3. Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, ... }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TokenExpired',
        message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
      });
    }
    return res.status(401).json({
      error: 'InvalidToken',
      message: 'Token không hợp lệ.'
    });
  }
};

module.exports = {
  authenticate
};
