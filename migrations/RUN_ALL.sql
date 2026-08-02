-- ========================================================
-- RUN_ALL.sql — Script tổng hợp toàn bộ migrations
-- Chạy TOÀN BỘ file này trong Supabase SQL Editor
-- Thứ tự: 000 → 001 → 002 → 003 → 004 → 005 → 006 → 007
-- ========================================================

-- ██████╗  ██████╗  ██████╗     ██████╗ ██╗  ██╗ █████╗ ███████╗███████╗
-- ██╔══██╗██╔═══██╗██╔═══██╗   ██╔══██╗██║  ██║██╔══██╗██╔════╝██╔════╝
-- ██║  ██║██║   ██║██║   ██║   ██████╔╝███████║███████║███████╗█████╗
-- ██║  ██║██║   ██║██║   ██║   ██╔═══╝ ██╔══██║██╔══██║╚════██║██╔══╝
-- ██████╔╝╚██████╔╝╚██████╔╝   ██║     ██║  ██║██║  ██║███████║███████╗
-- ╚═════╝  ╚═════╝  ╚═════╝    ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝
-- AI Smart Kanban — Database Migration v1.0.0
-- Target: Supabase PostgreSQL
-- ========================================================

-- ═══════════════════════════════════════════════════════
-- 000 - PREREQUISITE (Extensions & Shared Functions)
-- ═══════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════
-- 001 - WORKSPACES
-- ═══════════════════════════════════════════════════════

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
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền workspaces" ON public.workspaces FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon workspaces"           ON public.workspaces FOR ALL TO anon, authenticated USING (false);
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════
-- 002 - PROJECTS, MEMBERS, STATUSES, LABELS
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed', 'on_hold')),
    color           VARCHAR(7),
    icon            VARCHAR(50),
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
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id) WHERE status != 'archived';
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền projects" ON public.projects FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon projects"           ON public.projects FOR ALL TO anon, authenticated USING (false);
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.project_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_user    ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền project_members" ON public.project_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon project_members"           ON public.project_members FOR ALL TO anon, authenticated USING (false);

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

CREATE OR REPLACE FUNCTION public.seed_default_statuses(p_project_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.task_statuses (project_id, name, color, category, sort_order, is_default) VALUES
        (p_project_id, 'Mới',        '#64748b', 'todo',        0, true),
        (p_project_id, 'Đang làm',   '#3b82f6', 'in_progress', 1, false),
        (p_project_id, 'Chờ review', '#f59e0b', 'review',      2, false),
        (p_project_id, 'Hoàn thành', '#22c55e', 'done',        3, false),
        (p_project_id, 'Đã huỷ',     '#ef4444', 'cancelled',   4, false);
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════
-- 003 - TASKS CORE
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
    project_id          UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    parent_task_id      UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    status_id           UUID NOT NULL REFERENCES public.task_statuses(id) ON DELETE RESTRICT,
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    description_json    JSONB,
    priority            VARCHAR(20) NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
    task_type           VARCHAR(50) NOT NULL DEFAULT 'task'
                            CHECK (task_type IN ('task', 'bug', 'story', 'epic', 'feature', 'milestone')),
    start_date          TIMESTAMPTZ,
    due_date            TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    creator_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    assignee_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
    estimated_minutes   INTEGER CHECK (estimated_minutes >= 0),
    actual_minutes      INTEGER NOT NULL DEFAULT 0 CHECK (actual_minutes >= 0),
    story_points        INTEGER CHECK (story_points >= 0 AND story_points <= 100),
    sprint_id           UUID,
    sprint_order        INTEGER,
    sort_order          FLOAT NOT NULL DEFAULT 0,
    board_column_order  FLOAT NOT NULL DEFAULT 0,
    is_archived         BOOLEAN NOT NULL DEFAULT false,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    deleted_at          TIMESTAMPTZ,
    ai_estimated_minutes    INTEGER,
    ai_risk_score           FLOAT CHECK (ai_risk_score >= 0 AND ai_risk_score <= 1),
    ai_summary              TEXT,
    ai_tags                 TEXT[] DEFAULT '{}',
    ai_last_analyzed_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_fts       ON public.tasks USING GIN (to_tsvector('simple', title || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_tasks_workspace  ON public.tasks(workspace_id, created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_project    ON public.tasks(project_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee   ON public.tasks(assignee_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON public.tasks(status_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_parent     ON public.tasks(parent_task_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date   ON public.tasks(due_date) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_my_tasks   ON public.tasks(workspace_id, assignee_id, is_deleted, due_date);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền tasks" ON public.tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon tasks"           ON public.tasks FOR ALL TO anon, authenticated USING (false);
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.auto_set_completed_at()
RETURNS TRIGGER AS $$
DECLARE v_category VARCHAR(50);
BEGIN
    SELECT category INTO v_category FROM public.task_statuses WHERE id = NEW.status_id;
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

CREATE OR REPLACE VIEW public.active_tasks AS SELECT * FROM public.tasks WHERE is_deleted = false AND is_archived = false;

-- Functions dùng bảng tasks — phải đặt SAU khi tạo bảng tasks
CREATE OR REPLACE FUNCTION public.soft_delete_task(p_task_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.tasks SET is_deleted = true, deleted_at = NOW() WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.restore_task(p_task_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.tasks SET is_deleted = false, deleted_at = NULL WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_task_tree(p_task_id UUID)
RETURNS TABLE (id UUID, title VARCHAR, parent_task_id UUID, depth INTEGER) AS $$
WITH RECURSIVE task_tree AS (
    SELECT t.id, t.title, t.parent_task_id, 0 AS depth
    FROM public.tasks t WHERE t.id = p_task_id AND t.is_deleted = false
    UNION ALL
    SELECT t.id, t.title, t.parent_task_id, tt.depth + 1
    FROM public.tasks t
    INNER JOIN task_tree tt ON tt.id = t.parent_task_id
    WHERE t.is_deleted = false AND tt.depth < 10
)
SELECT * FROM task_tree;
$$ LANGUAGE sql;

-- ═══════════════════════════════════════════════════════
-- 004 - TASK RELATIONS
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.task_assignees (
    task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON public.task_assignees(user_id);
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_assignees" ON public.task_assignees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_assignees" ON public.task_assignees FOR ALL TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.task_labels (
    task_id   UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    label_id  UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
    tagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tagged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (task_id, label_id)
);
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_labels" ON public.task_labels FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_labels" ON public.task_labels FOR ALL TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    dependency_type   VARCHAR(50) NOT NULL DEFAULT 'finish_to_start'
                          CHECK (dependency_type IN ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')),
    lag_minutes       INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_dependency CHECK (task_id != depends_on_id),
    UNIQUE (task_id, depends_on_id)
);
CREATE INDEX IF NOT EXISTS idx_task_deps_task    ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends ON public.task_dependencies(depends_on_id);
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_dependencies" ON public.task_dependencies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_dependencies" ON public.task_dependencies FOR ALL TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.task_checklists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    title      VARCHAR(255),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_checklists_task ON public.task_checklists(task_id);
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_checklists" ON public.task_checklists FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_checklists" ON public.task_checklists FOR ALL TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.task_checklist_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES public.task_checklists(id) ON DELETE CASCADE,
    text         VARCHAR(1000) NOT NULL,
    is_done      BOOLEAN NOT NULL DEFAULT false,
    assignee_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    due_date     DATE,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON public.task_checklist_items(checklist_id);
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_checklist_items" ON public.task_checklist_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_checklist_items" ON public.task_checklist_items FOR ALL TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.task_comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    parent_comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
    content           TEXT NOT NULL,
    content_json      JSONB,
    is_edited         BOOLEAN NOT NULL DEFAULT false,
    edited_at         TIMESTAMPTZ,
    is_deleted        BOOLEAN NOT NULL DEFAULT false,
    reactions         JSONB NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task   ON public.task_comments(task_id, created_at ASC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_task_comments_parent ON public.task_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_comments" ON public.task_comments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_comments" ON public.task_comments FOR ALL TO anon, authenticated USING (false);
CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON public.task_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.task_attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    file_name   VARCHAR(500) NOT NULL,
    storage_key TEXT NOT NULL,
    thumbnail_key TEXT,
    file_size   BIGINT CHECK (file_size > 0),
    mime_type   VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_attachments" ON public.task_attachments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_attachments" ON public.task_attachments FOR ALL TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.time_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id           UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    started_at        TIMESTAMPTZ NOT NULL,
    ended_at          TIMESTAMPTZ,
    duration_minutes  INTEGER GENERATED ALWAYS AS (
                          CASE WHEN ended_at IS NOT NULL
                          THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
                          ELSE NULL END::INTEGER
                      ) STORED,
    note              TEXT,
    is_billable       BOOLEAN NOT NULL DEFAULT false,
    logged_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (ended_at IS NULL OR ended_at > started_at)
);
CREATE INDEX IF NOT EXISTS idx_time_logs_task ON public.time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user ON public.time_logs(user_id, started_at DESC);
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền time_logs" ON public.time_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon time_logs" ON public.time_logs FOR ALL TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.sync_task_actual_minutes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.tasks SET actual_minutes = (
        SELECT COALESCE(SUM(duration_minutes), 0) FROM public.time_logs
        WHERE task_id = COALESCE(NEW.task_id, OLD.task_id) AND ended_at IS NOT NULL
    ) WHERE id = COALESCE(NEW.task_id, OLD.task_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER sync_actual_minutes_on_timelog
AFTER INSERT OR UPDATE OR DELETE ON public.time_logs
FOR EACH ROW EXECUTE FUNCTION public.sync_task_actual_minutes();

CREATE TABLE IF NOT EXISTS public.task_activities (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id   UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    actor_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    action    VARCHAR(100) NOT NULL,
    field     VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    metadata  JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_activities_task  ON public.task_activities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_activities_actor ON public.task_activities(actor_id);
ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_activities" ON public.task_activities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_activities" ON public.task_activities FOR ALL TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.auto_log_task_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        INSERT INTO public.task_activities (task_id, actor_id, action, field, old_value, new_value)
        VALUES (NEW.id, NEW.creator_id, 'status_changed', 'status_id', to_jsonb(OLD.status_id::text), to_jsonb(NEW.status_id::text));
    END IF;
    IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
        INSERT INTO public.task_activities (task_id, actor_id, action, field, old_value, new_value)
        VALUES (NEW.id, NEW.creator_id, 'assignee_changed', 'assignee_id', to_jsonb(OLD.assignee_id::text), to_jsonb(NEW.assignee_id::text));
    END IF;
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
        INSERT INTO public.task_activities (task_id, actor_id, action, field, old_value, new_value)
        VALUES (NEW.id, NEW.creator_id, 'due_date_changed', 'due_date', to_jsonb(OLD.due_date::text), to_jsonb(NEW.due_date::text));
    END IF;
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO public.task_activities (task_id, actor_id, action, field, old_value, new_value)
        VALUES (NEW.id, NEW.creator_id, 'priority_changed', 'priority', to_jsonb(OLD.priority), to_jsonb(NEW.priority));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER auto_task_activity_trigger
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.auto_log_task_activity();

-- ═══════════════════════════════════════════════════════
-- 005 - SPRINTS
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sprints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    goal            TEXT,
    status          VARCHAR(50) NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    capacity_points INTEGER,
    velocity        INTEGER,
    retrospective   JSONB DEFAULT '{}',
    created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    CONSTRAINT sprint_dates_valid CHECK (end_date > start_date)
);
CREATE INDEX IF NOT EXISTS idx_sprints_project ON public.sprints(project_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_sprints_active  ON public.sprints(project_id) WHERE status = 'active';
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền sprints" ON public.sprints FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon sprints" ON public.sprints FOR ALL TO anon, authenticated USING (false);

ALTER TABLE public.tasks ADD CONSTRAINT tasks_sprint_id_fkey
    FOREIGN KEY (sprint_id) REFERENCES public.sprints(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.sprint_burndown (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id        UUID NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
    snapshot_date    DATE NOT NULL,
    remaining_points INTEGER NOT NULL DEFAULT 0,
    completed_points INTEGER NOT NULL DEFAULT 0,
    ideal_remaining  FLOAT,
    tasks_completed  INTEGER NOT NULL DEFAULT 0,
    tasks_total      INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sprint_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_sprint_burndown ON public.sprint_burndown(sprint_id, snapshot_date ASC);
ALTER TABLE public.sprint_burndown ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền sprint_burndown" ON public.sprint_burndown FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon sprint_burndown" ON public.sprint_burndown FOR ALL TO anon, authenticated USING (false);

-- ═══════════════════════════════════════════════════════
-- 006 - WORKFLOWS
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workflows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    trigger_type    VARCHAR(100) NOT NULL
                        CHECK (trigger_type IN (
                            'task_created','task_status_changed','task_assigned','task_unassigned',
                            'task_due_date_changed','task_due_date_passed','task_completed',
                            'task_deleted','comment_added','sprint_started','sprint_completed','scheduled'
                        )),
    trigger_config  JSONB NOT NULL DEFAULT '{}',
    conditions      JSONB NOT NULL DEFAULT '[]',
    condition_logic VARCHAR(10) NOT NULL DEFAULT 'AND' CHECK (condition_logic IN ('AND', 'OR')),
    actions         JSONB NOT NULL DEFAULT '[]',
    run_count       INTEGER NOT NULL DEFAULT 0,
    last_run_at     TIMESTAMPTZ,
    created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflows_workspace ON public.workflows(workspace_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflows_trigger   ON public.workflows(trigger_type)  WHERE is_active = true;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền workflows" ON public.workflows FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon workflows" ON public.workflows FOR ALL TO anon, authenticated USING (false);
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.workflow_runs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id        UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    task_id            UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    triggered_by       VARCHAR(100),
    status             VARCHAR(50) NOT NULL DEFAULT 'running'
                           CHECK (status IN ('running', 'success', 'failed', 'skipped', 'cancelled')),
    conditions_matched BOOLEAN,
    actions_executed   JSONB NOT NULL DEFAULT '[]',
    error_message      TEXT,
    duration_ms        INTEGER,
    started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs(workflow_id, started_at DESC);
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền workflow_runs" ON public.workflow_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon workflow_runs" ON public.workflow_runs FOR ALL TO anon, authenticated USING (false);

-- ═══════════════════════════════════════════════════════
-- 007 - PERFORMANCE, NOTIFICATIONS, CUSTOM FIELDS
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.performance_snapshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id              UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    sprint_id               UUID REFERENCES public.sprints(id) ON DELETE CASCADE,
    user_id                 UUID REFERENCES public.users(id) ON DELETE CASCADE,
    snapshot_date           DATE NOT NULL,
    tasks_created           INTEGER NOT NULL DEFAULT 0,
    tasks_completed         INTEGER NOT NULL DEFAULT 0,
    tasks_overdue           INTEGER NOT NULL DEFAULT 0,
    tasks_in_progress       INTEGER NOT NULL DEFAULT 0,
    tasks_blocked           INTEGER NOT NULL DEFAULT 0,
    total_estimated_minutes INTEGER NOT NULL DEFAULT 0,
    total_actual_minutes    INTEGER NOT NULL DEFAULT 0,
    on_time_rate            FLOAT CHECK (on_time_rate >= 0 AND on_time_rate <= 1),
    story_points_planned    INTEGER NOT NULL DEFAULT 0,
    story_points_completed  INTEGER NOT NULL DEFAULT 0,
    velocity                FLOAT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_perf_workspace ON public.performance_snapshots(workspace_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_perf_user      ON public.performance_snapshots(user_id, snapshot_date DESC) WHERE user_id IS NOT NULL;
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền performance_snapshots" ON public.performance_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon performance_snapshots" ON public.performance_snapshots FOR ALL TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type       VARCHAR(100) NOT NULL
                   CHECK (type IN ('task_assigned','task_comment','task_mention','task_due_soon',
                                   'task_overdue','task_status_changed','task_completed',
                                   'sprint_started','sprint_ending_soon','sprint_completed',
                                   'workflow_triggered','project_invite','system')),
    title      VARCHAR(500) NOT NULL,
    body       TEXT,
    link       TEXT,
    is_read    BOOLEAN NOT NULL DEFAULT false,
    read_at    TIMESTAMPTZ,
    metadata   JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC) WHERE is_read = false;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền notifications" ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon notifications" ON public.notifications FOR ALL TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.custom_fields (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    field_type  VARCHAR(50) NOT NULL
                    CHECK (field_type IN ('text','number','date','boolean','select','multi_select','url','email','phone')),
    options     JSONB DEFAULT '[]',
    is_required BOOLEAN NOT NULL DEFAULT false,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền custom_fields" ON public.custom_fields FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon custom_fields" ON public.custom_fields FOR ALL TO anon, authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.task_custom_field_values (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    field_id   UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
    value      JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_custom_values_task ON public.task_custom_field_values(task_id);
ALTER TABLE public.task_custom_field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_custom_field_values" ON public.task_custom_field_values FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_custom_field_values" ON public.task_custom_field_values FOR ALL TO anon, authenticated USING (false);

-- ========================================================
-- ✅ MIGRATION HOÀN TẤT
-- Tổng cộng: 15 bảng + 8 indexes groups + triggers + views
-- ========================================================
