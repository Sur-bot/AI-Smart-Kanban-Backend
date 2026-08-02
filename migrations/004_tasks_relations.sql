-- ========================================================
-- Migration: 004_tasks_relations.sql
-- Mô tả: Bảng phụ của tasks: assignees, labels, dependencies,
--        checklists, comments, attachments, time_logs, activities
-- Phụ thuộc: 003_tasks_core.sql
-- ========================================================

-- ─── Task Assignees (nhiều người nhận) ──────────────────
CREATE TABLE IF NOT EXISTS public.task_assignees (
    task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON public.task_assignees(user_id);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_assignees" ON public.task_assignees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_assignees"           ON public.task_assignees FOR ALL TO anon, authenticated USING (false);


-- ─── Task Labels ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_labels (
    task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    label_id    UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
    tagged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tagged_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (task_id, label_id)
);

ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_labels" ON public.task_labels FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_labels"           ON public.task_labels FOR ALL TO anon, authenticated USING (false);


-- ─── Task Dependencies ──────────────────────────────────
-- Mối phụ thuộc giữa các task (dùng trong Gantt & Workflow)
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id             UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_id       UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    dependency_type     VARCHAR(50) NOT NULL DEFAULT 'finish_to_start'
                            CHECK (dependency_type IN (
                                'finish_to_start',   -- FS: phổ biến nhất
                                'start_to_start',    -- SS
                                'finish_to_finish',  -- FF
                                'start_to_finish'    -- SF
                            )),
    lag_minutes         INTEGER DEFAULT 0,          -- Độ trễ giữa hai task (phút)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_dependency CHECK (task_id != depends_on_id),
    UNIQUE (task_id, depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_task     ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends  ON public.task_dependencies(depends_on_id);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_dependencies" ON public.task_dependencies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_dependencies"           ON public.task_dependencies FOR ALL TO anon, authenticated USING (false);


-- ─── Task Checklists ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_checklists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    title       VARCHAR(255),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_checklists_task ON public.task_checklists(task_id);

ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_checklists" ON public.task_checklists FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_checklists"           ON public.task_checklists FOR ALL TO anon, authenticated USING (false);


-- Các mục trong checklist
CREATE TABLE IF NOT EXISTS public.task_checklist_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id    UUID NOT NULL REFERENCES public.task_checklists(id) ON DELETE CASCADE,
    text            VARCHAR(1000) NOT NULL,
    is_done         BOOLEAN NOT NULL DEFAULT false,
    assignee_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
    due_date        DATE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    completed_at    TIMESTAMPTZ,
    completed_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON public.task_checklist_items(checklist_id);

ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_checklist_items" ON public.task_checklist_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_checklist_items"           ON public.task_checklist_items FOR ALL TO anon, authenticated USING (false);


-- ─── Task Comments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_comments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id             UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    parent_comment_id   UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,  -- Thread/Reply
    content             TEXT NOT NULL,
    content_json        JSONB,              -- Rich text structured JSON
    is_edited           BOOLEAN NOT NULL DEFAULT false,
    edited_at           TIMESTAMPTZ,
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    reactions           JSONB NOT NULL DEFAULT '{}',  -- {"👍": ["uid1", "uid2"], "❤️": ["uid3"]}
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task      ON public.task_comments(task_id, created_at ASC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_task_comments_parent    ON public.task_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_comments_author    ON public.task_comments(author_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_comments" ON public.task_comments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_comments"           ON public.task_comments FOR ALL TO anon, authenticated USING (false);

CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── Task Attachments ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    file_name       VARCHAR(500) NOT NULL,
    storage_key     TEXT NOT NULL,
    thumbnail_key   TEXT,
    file_size       BIGINT CHECK (file_size > 0),
    mime_type       VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_attachments" ON public.task_attachments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_attachments"           ON public.task_attachments FOR ALL TO anon, authenticated USING (false);


-- ─── Time Logs (Chấm công) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id             UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    started_at          TIMESTAMPTZ NOT NULL,
    ended_at            TIMESTAMPTZ,
    duration_minutes    INTEGER GENERATED ALWAYS AS (
                            CASE
                                WHEN ended_at IS NOT NULL
                                THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
                                ELSE NULL
                            END::INTEGER
                        ) STORED,
    note                TEXT,
    is_billable         BOOLEAN NOT NULL DEFAULT false,
    logged_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_time_logs_task ON public.time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user ON public.time_logs(user_id, started_at DESC);

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền time_logs" ON public.time_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon time_logs"           ON public.time_logs FOR ALL TO anon, authenticated USING (false);

-- Trigger: Cập nhật actual_minutes trong tasks khi có time_log mới
CREATE OR REPLACE FUNCTION public.sync_task_actual_minutes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.tasks
    SET actual_minutes = (
        SELECT COALESCE(SUM(duration_minutes), 0)
        FROM public.time_logs
        WHERE task_id = COALESCE(NEW.task_id, OLD.task_id)
          AND ended_at IS NOT NULL
    )
    WHERE id = COALESCE(NEW.task_id, OLD.task_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_actual_minutes_on_timelog
AFTER INSERT OR UPDATE OR DELETE ON public.time_logs
FOR EACH ROW EXECUTE FUNCTION public.sync_task_actual_minutes();


-- ─── Task Activities (Audit Log) ────────────────────────
CREATE TABLE IF NOT EXISTS public.task_activities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    actor_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    action      VARCHAR(100) NOT NULL,      -- e.g. 'status_changed', 'assignee_added', 'due_date_updated'
    field       VARCHAR(100),               -- Tên trường bị thay đổi
    old_value   JSONB,                      -- Giá trị cũ
    new_value   JSONB,                      -- Giá trị mới
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activities_task ON public.task_activities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_activities_actor ON public.task_activities(actor_id);

ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền task_activities" ON public.task_activities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon task_activities"           ON public.task_activities FOR ALL TO anon, authenticated USING (false);


-- ─── Trigger: Tự động ghi activity log khi task thay đổi ─
CREATE OR REPLACE FUNCTION public.auto_log_task_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Log thay đổi status
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        INSERT INTO public.task_activities (task_id, actor_id, action, field, old_value, new_value)
        VALUES (NEW.id, NEW.creator_id, 'status_changed', 'status_id',
                to_jsonb(OLD.status_id::text), to_jsonb(NEW.status_id::text));
    END IF;

    -- Log thay đổi assignee
    IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
        INSERT INTO public.task_activities (task_id, actor_id, action, field, old_value, new_value)
        VALUES (NEW.id, NEW.creator_id, 'assignee_changed', 'assignee_id',
                to_jsonb(OLD.assignee_id::text), to_jsonb(NEW.assignee_id::text));
    END IF;

    -- Log thay đổi due_date
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
        INSERT INTO public.task_activities (task_id, actor_id, action, field, old_value, new_value)
        VALUES (NEW.id, NEW.creator_id, 'due_date_changed', 'due_date',
                to_jsonb(OLD.due_date::text), to_jsonb(NEW.due_date::text));
    END IF;

    -- Log thay đổi priority
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO public.task_activities (task_id, actor_id, action, field, old_value, new_value)
        VALUES (NEW.id, NEW.creator_id, 'priority_changed', 'priority',
                to_jsonb(OLD.priority), to_jsonb(NEW.priority));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_task_activity_trigger
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.auto_log_task_activity();
