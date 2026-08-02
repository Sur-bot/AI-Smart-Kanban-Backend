-- ========================================================
-- Migration: 002_projects.sql
-- Mô tả: Bảng projects, project_members, task_statuses, labels
-- Phụ thuộc: 001_workspaces.sql
-- ========================================================

-- ─── Projects ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived', 'completed', 'on_hold')),
    color           VARCHAR(7),                     -- Hex color, e.g. #3b82f6
    icon            VARCHAR(50),                    -- Material icon name
    cover_url       TEXT,
    owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    start_date      DATE,
    end_date        DATE,
    is_public       BOOLEAN NOT NULL DEFAULT false,
    settings        JSONB NOT NULL DEFAULT '{}',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id)
    WHERE status != 'archived';

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền projects" ON public.projects FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon projects"         ON public.projects FOR ALL TO anon, authenticated USING (false);

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── Project Members ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền project_members" ON public.project_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon project_members"           ON public.project_members FOR ALL TO anon, authenticated USING (false);


-- ─── Task Statuses (tuỳ chỉnh theo dự án) ──────────────
-- Mỗi dự án có bộ trạng thái riêng, ánh xạ vào 4 category chuẩn
CREATE TABLE IF NOT EXISTS public.task_statuses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(7) NOT NULL DEFAULT '#94a3b8',
    icon        VARCHAR(50),
    category    VARCHAR(50) NOT NULL DEFAULT 'in_progress'
                    CHECK (category IN ('todo', 'in_progress', 'review', 'done', 'cancelled')),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_statuses_project ON public.task_statuses(project_id);

ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_statuses" ON public.task_statuses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_statuses"           ON public.task_statuses FOR ALL TO anon, authenticated USING (false);


-- ─── Labels ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.labels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    color           VARCHAR(7) NOT NULL,
    created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labels_workspace ON public.labels(workspace_id);

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền labels" ON public.labels FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon labels"           ON public.labels FOR ALL TO anon, authenticated USING (false);


-- ─── Seed: Tạo bộ trạng thái mặc định khi tạo project ──
-- Sử dụng function để gọi từ backend sau khi INSERT project
CREATE OR REPLACE FUNCTION public.seed_default_statuses(p_project_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.task_statuses (project_id, name, color, category, sort_order, is_default) VALUES
        (p_project_id, 'Mới',           '#64748b', 'todo',        0, true),
        (p_project_id, 'Đang làm',      '#3b82f6', 'in_progress', 1, false),
        (p_project_id, 'Chờ review',    '#f59e0b', 'review',      2, false),
        (p_project_id, 'Hoàn thành',    '#22c55e', 'done',        3, false),
        (p_project_id, 'Đã huỷ',        '#ef4444', 'cancelled',   4, false);
END;
$$ LANGUAGE plpgsql;
