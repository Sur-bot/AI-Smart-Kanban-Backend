-- ========================================================
-- Migration: 007_performance.sql
-- Mô tả: Bảng hiệu suất, thông báo, custom fields
-- Phụ thuộc: 001, 002, 003, 005
-- ========================================================

-- ─── Performance Snapshots ──────────────────────────────
-- Snapshot được tính mỗi ngày bởi performanceWorker.js
CREATE TABLE IF NOT EXISTS public.performance_snapshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id              UUID REFERENCES public.projects(id) ON DELETE CASCADE,    -- NULL = toàn workspace
    sprint_id               UUID REFERENCES public.sprints(id) ON DELETE CASCADE,     -- NULL = không theo sprint
    user_id                 UUID REFERENCES public.users(id) ON DELETE CASCADE,       -- NULL = toàn nhóm
    snapshot_date           DATE NOT NULL,

    -- Task Metrics
    tasks_created           INTEGER NOT NULL DEFAULT 0,
    tasks_completed         INTEGER NOT NULL DEFAULT 0,
    tasks_overdue           INTEGER NOT NULL DEFAULT 0,
    tasks_in_progress       INTEGER NOT NULL DEFAULT 0,
    tasks_blocked           INTEGER NOT NULL DEFAULT 0,

    -- Thời gian
    total_estimated_minutes INTEGER NOT NULL DEFAULT 0,
    total_actual_minutes    INTEGER NOT NULL DEFAULT 0,
    on_time_rate            FLOAT CHECK (on_time_rate >= 0 AND on_time_rate <= 1),    -- 0→1

    -- Scrum
    story_points_planned    INTEGER NOT NULL DEFAULT 0,
    story_points_completed  INTEGER NOT NULL DEFAULT 0,
    velocity                FLOAT,

    -- Computed columns
    estimation_accuracy     FLOAT GENERATED ALWAYS AS (
                                CASE
                                    WHEN total_estimated_minutes > 0
                                    THEN LEAST(1.0, total_actual_minutes::FLOAT / total_estimated_minutes)
                                    ELSE NULL
                                END
                            ) STORED,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE NULLS NOT DISTINCT (workspace_id, project_id, sprint_id, user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_perf_workspace ON public.performance_snapshots(workspace_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_perf_project   ON public.performance_snapshots(project_id, snapshot_date DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_perf_sprint    ON public.performance_snapshots(sprint_id) WHERE sprint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_perf_user      ON public.performance_snapshots(user_id, snapshot_date DESC) WHERE user_id IS NOT NULL;

ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền performance_snapshots" ON public.performance_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon performance_snapshots"           ON public.performance_snapshots FOR ALL TO anon, authenticated USING (false);


-- ─── Notifications ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type        VARCHAR(100) NOT NULL
                    CHECK (type IN (
                        'task_assigned',
                        'task_comment',
                        'task_mention',
                        'task_due_soon',
                        'task_overdue',
                        'task_status_changed',
                        'task_completed',
                        'sprint_started',
                        'sprint_ending_soon',
                        'sprint_completed',
                        'workflow_triggered',
                        'project_invite',
                        'system'
                    )),
    title       VARCHAR(500) NOT NULL,
    body        TEXT,
    link        TEXT,                   -- Deep link vào app, e.g. /app/kanban?task=uuid
    is_read     BOOLEAN NOT NULL DEFAULT false,
    read_at     TIMESTAMPTZ,
    metadata    JSONB NOT NULL DEFAULT '{}',   -- {task_id, project_id, actor_id, ...}
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user     ON public.notifications(user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_all ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền notifications" ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon notifications"           ON public.notifications FOR ALL TO anon, authenticated USING (false);


-- ─── Custom Fields ──────────────────────────────────────
-- Cho phép mỗi dự án định nghĩa thêm trường tuỳ chỉnh
CREATE TABLE IF NOT EXISTS public.custom_fields (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    field_type      VARCHAR(50) NOT NULL
                        CHECK (field_type IN (
                            'text', 'number', 'date', 'boolean',
                            'select', 'multi_select', 'url', 'email', 'phone'
                        )),
    options         JSONB DEFAULT '[]',     -- Cho select/multi_select: [{label, color, value}]
    is_required     BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền custom_fields" ON public.custom_fields FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon custom_fields"           ON public.custom_fields FOR ALL TO anon, authenticated USING (false);


-- Giá trị custom field cho từng task
CREATE TABLE IF NOT EXISTS public.task_custom_field_values (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    field_id        UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
    value           JSONB,              -- Lưu bất kỳ loại giá trị nào
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_values_task ON public.task_custom_field_values(task_id);

ALTER TABLE public.task_custom_field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_custom_field_values" ON public.task_custom_field_values FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_custom_field_values"           ON public.task_custom_field_values FOR ALL TO anon, authenticated USING (false);
