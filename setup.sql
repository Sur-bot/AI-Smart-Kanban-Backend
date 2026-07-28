-- CHẠY SCRIPT NÀY TRONG SUPABASE SQL EDITOR

-- 1. Tạo bảng users
CREATE TABLE public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Bật RLS (Row Level Security) cho bảng users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Cấu hình Policies
-- Chỉ cho phép service_role (API Backend) được toàn quyền truy cập. 
-- Điều này nghĩa là frontend không thể chọc trực tiếp vào bảng users qua Supabase API, 
-- chặn hoàn toàn quyền Guest (anon).
CREATE POLICY "Cho phép Backend toàn quyền trên users" 
ON public.users
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- (Tùy chọn) Policy thứ 2: Tạm khóa toàn bộ quyền của role 'anon' và 'authenticated' trên frontend
-- để buộc mọi query Auth phải đi qua backend Node.js
CREATE POLICY "Khóa quyền Guest trên users"
ON public.users
FOR ALL
TO anon, authenticated
USING (false);

-- 4. Tạo trigger cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
