-- ========================================================
-- Migration: 001_workspaces.sql
-- Mô tả: Tạo bảng workspaces — đơn vị tổ chức cao nhất
-- Chạy trước tất cả migration khác
-- ========================================================

-- Bảng Workspace
CREATE TABLE IF NOT EXISTS public.workspaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    owner_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    logo_url    TEXT,
    settings    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend toàn quyền workspaces"
ON public.workspaces FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Khóa quyền anon/authenticated workspaces"
ON public.workspaces FOR ALL TO anon, authenticated
USING (false);

-- Trigger updated_at
CREATE TRIGGER update_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tạo workspace mặc định cho user đầu tiên (seed data)
-- INSERT sẽ được xử lý bởi backend khi user đăng ký
