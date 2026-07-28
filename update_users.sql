-- CHẠY SCRIPT NÀY TRONG SUPABASE SQL EDITOR ĐỂ CẬP NHẬT BẢNG USERS

-- 1. Thêm các cột phục vụ cho tính năng Xác minh Email
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMP WITH TIME ZONE;

-- 2. Tạo Index cho cột verification_token để truy vấn nhanh hơn khi xác minh
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON public.users(verification_token);
