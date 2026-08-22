const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { sendVerificationEmail } = require('../services/emailService');
const projectService = require('../services/projectService');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_for_development_only';
const JWT_EXPIRES_IN = '15m'; // Access token sống 15 phút
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // Refresh token sống 7 ngày

// Helper tạo JWT
const generateTokens = (user) => {
  const payload = { id: user.id, email: user.email };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  return { accessToken, refreshToken };
};

// ĐĂNG KÝ
exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email và mật khẩu không được để trống' });
    }

    // 1. Kiểm tra email đã tồn tại chưa
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingUser) {
      return res.status(400).json({ error: 'Email đã được sử dụng' });
    }

    // 2. Hash password & tạo Verification Token
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token hết hạn sau 24h

    // 3. Lưu vào DB
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ 
        email, 
        password_hash: hashedPassword,
        is_verified: false,
        verification_token: verificationToken,
        verification_expires: expiresAt.toISOString()
      }])
      .select('id, email, name, avatar_url')
      .single();

    if (insertError) throw insertError;

    // 4. Tạo Workspace và Project mặc định cho user mới
    const ws = await projectService.getOrCreateDefaultWorkspace(newUser.id);
    await projectService.getOrCreateDefaultProject(ws.id, newUser.id);

    // 5. Gửi email xác minh (chạy ngầm không block response)
    sendVerificationEmail(email, verificationToken);

    // 5. Trả về thành công
    return res.status(201).json({ message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản.', user: newUser });
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.status(500).json({ error: 'Lỗi server nội bộ' });
  }
};

// XÁC MINH EMAIL
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Thiếu token xác minh' });
    }

    // Tìm user có token này và chưa hết hạn
    const { data: user, error } = await supabase
      .from('users')
      .select('id, verification_expires, is_verified')
      .eq('verification_token', token)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'Token không hợp lệ hoặc không tồn tại' });
    }

    if (user.is_verified) {
      return res.status(400).json({ error: 'Email này đã được xác minh trước đó' });
    }

    if (new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Token xác minh đã hết hạn. Vui lòng yêu cầu gửi lại email.' });
    }

    // Cập nhật trạng thái
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        is_verified: true, 
        verification_token: null, 
        verification_expires: null 
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return res.status(200).json({ message: 'Xác minh email thành công. Bạn có thể đăng nhập ngay bây giờ.' });
  } catch (error) {
    console.error('[Verify Email Error]:', error);
    return res.status(500).json({ error: 'Lỗi server nội bộ' });
  }
};

// GỬI LẠI EMAIL XÁC MINH
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email không được để trống' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, is_verified')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản với email này' });
    }

    if (user.is_verified) {
      return res.status(400).json({ error: 'Tài khoản này đã được xác minh trước đó' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await supabase
      .from('users')
      .update({
        verification_token: verificationToken,
        verification_expires: expiresAt.toISOString()
      })
      .eq('id', user.id);

    sendVerificationEmail(email, verificationToken);

    return res.status(200).json({ message: 'Đã gửi lại email xác minh thành công. Vui lòng kiểm tra hộp thư.' });
  } catch (error) {
    console.error('[Resend Verification Error]:', error);
    return res.status(500).json({ error: 'Lỗi server nội bộ' });
  }
};

// ĐĂNG NHẬP
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Tìm user theo email
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    // Kiểm tra đã xác minh email chưa
    if (!user.is_verified) {
      return res.status(403).json({ error: 'Vui lòng xác minh địa chỉ email trước khi đăng nhập' });
    }

    // 2. Kiểm tra password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    // 3. Tạo token
    const { accessToken, refreshToken } = generateTokens(user);

    // 4. Lưu refresh token vào DB
    await supabase
      .from('users')
      .update({ refresh_token: refreshToken })
      .eq('id', user.id);

    // 5. Trả về HttpOnly Cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000 // 15 phút
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
    });

    // 6. Trả thông tin user cho frontend
    const { password_hash, refresh_token, verification_token, verification_expires, ...safeUser } = user;
    return res.status(200).json({ message: 'Đăng nhập thành công', user: safeUser });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({ error: 'Lỗi server nội bộ' });
  }
};

// ĐĂNG XUẤT
exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    
    // Nếu có token, xóa nó khỏi DB
    if (refreshToken) {
      // Decode để lấy ID (có thể cần jwt.verify nếu cần chính xác)
      const decoded = jwt.decode(refreshToken);
      if (decoded && decoded.id) {
        await supabase
          .from('users')
          .update({ refresh_token: null })
          .eq('id', decoded.id);
      }
    }

    // Xóa cookie
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return res.status(200).json({ message: 'Đã đăng xuất' });
  } catch (error) {
    console.error('[Logout Error]:', error);
    return res.status(500).json({ error: 'Lỗi server nội bộ' });
  }
};

// LÀM MỚI TOKEN (REFRESH)
exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Không tìm thấy refresh token' });
    }

    // 1. Verify token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    // 2. Kiểm tra token có khớp với DB không
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (!user || user.refresh_token !== refreshToken) {
      return res.status(403).json({ error: 'Refresh token đã bị thu hồi' });
    }

    // 3. Tạo token mới
    const tokens = generateTokens(user);

    // 4. Lưu refresh token mới vào DB
    await supabase
      .from('users')
      .update({ refresh_token: tokens.refreshToken })
      .eq('id', user.id);

    // 5. Trả về Cookies mới
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({ message: 'Làm mới token thành công' });
  } catch (error) {
    console.error('[Refresh Error]:', error);
    return res.status(500).json({ error: 'Lỗi server nội bộ' });
  }
};
