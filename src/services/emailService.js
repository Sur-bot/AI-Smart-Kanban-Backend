const nodemailer = require('nodemailer');

/**
 * Khởi tạo Transporter cho Nodemailer
 * Hỗ trợ Gmail SMTP với App Password (Mật khẩu ứng dụng của Google)
 */
const createTransporter = () => {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass
    }
  });
};

/**
 * Gửi email xác minh tài khoản qua Gmail SMTP
 */
const sendVerificationEmail = async (toEmail, verificationToken) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    const transporter = createTransporter();
    const fromSender = process.env.SMTP_FROM || process.env.GMAIL_USER || 'AI Smart Kanban <no-reply@kanban.app>';

    // Nếu chưa cấu hình App Password trong .env, in link ra terminal để test trực tiếp
    if (!transporter) {
      console.log('\n──────────────────────────────────────────────────────────');
      console.log('📬 [EMAIL SERVICE - DEV MODE] CHƯA CẤU HÌNH GMAIL SMTP');
      console.log(`👉 Gửi tới: ${toEmail}`);
      console.log(`🔗 Link xác thực: ${verifyUrl}`);
      console.log('💡 Để gửi mail thật, hãy thêm GMAIL_USER và GMAIL_APP_PASSWORD vào file .env');
      console.log('──────────────────────────────────────────────────────────\n');
      return true;
    }

    const mailOptions = {
      from: `"AI Smart Kanban" <${fromSender}>`,
      to: toEmail,
      subject: 'Xác minh địa chỉ Email của bạn - AI Smart Kanban',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f8fafc; border-radius: 16px;">
          <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 700;">AI Smart Kanban</h1>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Hệ thống quản lý công việc và tác vụ thông minh</p>
            </div>
            
            <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">Chào mừng bạn tham gia!</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
              Cảm ơn bạn đã đăng ký tài khoản tại <strong>AI Smart Kanban</strong>. Để kích hoạt tài khoản và bắt đầu sử dụng, vui lòng xác nhận địa chỉ email bằng cách nhấn vào nút bên dưới:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${verifyUrl}" style="background-color: #3b82f6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
                Xác minh Email ngay
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 13px; margin-bottom: 8px;">Nếu nút bấm trên không hoạt động, bạn có thể sao chép và dán liên kết sau vào trình duyệt:</p>
            <p style="color: #2563eb; font-size: 13px; word-break: break-all; margin-top: 0; padding: 12px; background-color: #f1f5f9; border-radius: 6px;">
              ${verifyUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 24px;" />
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
              Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email. Liên kết xác thực sẽ có hiệu lực trong vòng 24 giờ.
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Đã gửi email xác minh thành công tới ${toEmail}! MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('[EmailService] Lỗi khi gửi email qua Gmail SMTP:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail
};
