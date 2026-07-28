const { Resend } = require('resend');

// Khởi tạo SDK Resend với API Key từ file .env
// Nếu chưa có RESEND_API_KEY, hàm gửi email sẽ tự động báo lỗi an toàn.
const resend = new Resend(process.env.RESEND_API_KEY);

const sendVerificationEmail = async (toEmail, verificationToken) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[EmailService] BỎ QUA GỬI EMAIL: Chưa cấu hình RESEND_API_KEY trong .env');
      return false;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    // Tên miền gửi đi. Bạn nên thay thế bằng tên miền thật (Ví dụ: no-reply@digit24.dpdns.org)
    // Nếu bạn chưa verified tên miền, Resend có cung cấp email test là: onboarding@resend.dev (nhưng chỉ gửi được cho chính email đăng ký Resend của bạn).
    const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    const { data, error } = await resend.emails.send({
      from: `Digit24 Support <${fromEmail}>`,
      to: [toEmail],
      subject: 'Xác minh địa chỉ Email của bạn - Digit24',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f8fafc; border-radius: 16px;">
          <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <h2 style="color: #0f172a; text-align: center; margin-top: 0; font-size: 24px;">Chào mừng bạn đến với Digit24!</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Cảm ơn bạn đã đăng ký tài khoản. Để bảo mật thông tin và hoàn tất quá trình đăng ký, vui lòng bấm vào nút bên dưới để xác minh địa chỉ email của bạn:
            </p>
            
            <div style="text-align: center; margin: 36px 0;">
              <a href="${verifyUrl}" style="background-color: #bef264; color: #0f172a; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;">
                Xác minh Email ngay
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-bottom: 8px;">Nếu nút bấm không hoạt động, bạn có thể copy và dán đường link này vào trình duyệt:</p>
            <p style="color: #3b82f6; font-size: 14px; word-break: break-all; margin-top: 0; padding: 12px; background-color: #f1f5f9; border-radius: 6px;">
              ${verifyUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 24px;" />
            <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 0;">
              Nếu bạn không yêu cầu đăng ký, vui lòng bỏ qua email này. Link xác minh sẽ hết hạn sau 24 giờ.
            </p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('[EmailService] Lỗi Resend:', error);
      return false;
    }

    console.log('[EmailService] Đã gửi email xác minh thành công! Message ID:', data.id);
    return true;
  } catch (error) {
    console.error('[EmailService] Lỗi hệ thống khi gửi email:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail
};
