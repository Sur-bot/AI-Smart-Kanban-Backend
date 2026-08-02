-- ========================================================
-- Migration: 003_tasks_core.sql
-- Mô tả: Bảng tasks — TRUNG TÂM của toàn bộ hệ thống
-- Phụ thuộc: 001, 002
-- ========================================================

-- ─── Core Tasks Table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Phân cấp tổ chức
    workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
    project_id          UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    parent_task_id      UUID REFERENCES public.tasks(id) ON DELETE CASCADE,   -- Sub-task

    -- Trạng thái
    status_id           UUID NOT NULL REFERENCES public.task_statuses(id) ON DELETE RESTRICT,

    -- Thông tin cơ bản
    title               VARCHAR(500) NOT NULL,
    description         TEXT,                       -- Plain text / Markdown
    description_json    JSONB,                      -- Tiptap/ProseMirror structured JSON

    -- Phân loại
    priority            VARCHAR(20) NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
    task_type           VARCHAR(50) NOT NULL DEFAULT 'task'
                            CHECK (task_type IN ('task', 'bug', 'story', 'epic', 'feature', 'milestone')),

    -- Thời gian
    start_date          TIMESTAMPTZ,
    due_date            TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,

    -- Người liên quan
    creator_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    assignee_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- Người nhận chính

    -- Ước tính & Thực tế
    estimated_minutes   INTEGER CHECK (estimated_minutes >= 0),
    actual_minutes      INTEGER NOT NULL DEFAULT 0 CHECK (actual_minutes >= 0),
    story_points        INTEGER CHECK (story_points >= 0 AND story_points <= 100),

    -- Scrum (sprint_id FK sẽ được thêm sau migration 005_sprints.sql)
    sprint_id           UUID,
    sprint_order        INTEGER,

    -- Thứ tự sắp xếp (dùng FLOAT để hỗ trợ drag-drop không cần reindex)
    sort_order          FLOAT NOT NULL DEFAULT 0,
    board_column_order  FLOAT NOT NULL DEFAULT 0,

    -- Trạng thái hệ thống
    is_archived         BOOLEAN NOT NULL DEFAULT false,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    deleted_at          TIMESTAMPTZ,

    -- AI Fields
    ai_estimated_minutes    INTEGER,
    ai_risk_score           FLOAT CHECK (ai_risk_score >= 0 AND ai_risk_score <= 1),
    ai_summary              TEXT,
    ai_tags                 TEXT[] DEFAULT '{}',
    ai_last_analyzed_at     TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────
-- Full-text search (tiêu đề + mô tả)
CREATE INDEX IF NOT EXISTS idx_tasks_fts
ON public.tasks USING GIN (
    to_tsvector('simple', title || ' ' || COALESCE(description, ''))
);

-- Query phổ biến
CREATE INDEX IF NOT EXISTS idx_tasks_workspace      ON public.tasks(workspace_id, created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_project        ON public.tasks(project_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee       ON public.tasks(assignee_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_sprint         ON public.tasks(sprint_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date       ON public.tasks(due_date) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_status         ON public.tasks(status_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_parent         ON public.tasks(parent_task_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_creator        ON public.tasks(creator_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_priority       ON public.tasks(priority) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_ai_risk        ON public.tasks(ai_risk_score DESC) WHERE is_deleted = false AND ai_risk_score IS NOT NULL;

-- Compound index cho query "Tác vụ của tôi"
CREATE INDEX IF NOT EXISTS idx_tasks_my_tasks
ON public.tasks(workspace_id, assignee_id, is_deleted, due_date);

-- ─── RLS ────────────────────────────────────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend toàn quyền tasks"
ON public.tasks FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Khóa anon tasks"
ON public.tasks FOR ALL TO anon, authenticated
USING (false);

-- ─── Triggers ───────────────────────────────────────────
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Tự động điền completed_at khi status chuyển sang done
CREATE OR REPLACE FUNCTION public.auto_set_completed_at()
RETURNS TRIGGER AS $$
DECLARE
    v_category VARCHAR(50);
BEGIN
    -- Kiểm tra category của status mới
    SELECT category INTO v_category
    FROM public.task_statuses
    WHERE id = NEW.status_id;

    IF v_category = 'done' AND OLD.completed_at IS NULL THEN
        NEW.completed_at = NOW();
    ELSIF v_category != 'done' THEN
        NEW.completed_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_completed_at_trigger
BEFORE UPDATE OF status_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.auto_set_completed_at();

-- Trigger: Tự động cập nhật actual_minutes từ time_logs (sẽ kết nối sau)
-- Được define trong migration 004_tasks_relations.sql


-- ─── View: Tasks không bị xóa (shortcut thường dùng) ───
CREATE OR REPLACE VIEW public.active_tasks AS
SELECT * FROM public.tasks
WHERE is_deleted = false AND is_archived = false;
