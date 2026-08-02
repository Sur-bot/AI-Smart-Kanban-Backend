-- ========================================================
-- Migration: 006_workflows.sql
-- Mô tả: Bảng workflows và workflow_runs (Luồng tự động hóa)
-- Phụ thuộc: 001, 002, 003
-- ========================================================

-- ─── Workflows ──────────────────────────────────────────
-- Mỗi workflow là một quy tắc IF (trigger + conditions) THEN (actions)
CREATE TABLE IF NOT EXISTS public.workflows (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id          UUID REFERENCES public.projects(id) ON DELETE CASCADE, -- NULL = áp dụng toàn workspace
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,

    -- Trigger: loại sự kiện kích hoạt workflow
    trigger_type        VARCHAR(100) NOT NULL
                            CHECK (trigger_type IN (
                                'task_created',
                                'task_status_changed',
                                'task_assigned',
                                'task_unassigned',
                                'task_due_date_changed',
                                'task_due_date_passed',
                                'task_completed',
                                'task_deleted',
                                'comment_added',
                                'sprint_started',
                                'sprint_completed',
                                'scheduled'              -- CRON-based
                            )),

    -- Cấu hình của trigger (JSON schema)
    -- Ví dụ scheduled: {"cron": "0 9 * * 1", "timezone": "Asia/Ho_Chi_Minh"}
    trigger_config      JSONB NOT NULL DEFAULT '{}',

    -- Conditions: mảng điều kiện kết hợp AND/OR
    -- Ví dụ: [{"field": "priority", "op": "eq", "value": "urgent"}, ...]
    conditions          JSONB NOT NULL DEFAULT '[]',
    condition_logic     VARCHAR(10) NOT NULL DEFAULT 'AND'
                            CHECK (condition_logic IN ('AND', 'OR')),

    -- Actions: danh sách hành động thực hiện theo thứ tự
    -- Ví dụ: [{"type": "change_status", "value": "uuid-of-status"}, ...]
    actions             JSONB NOT NULL DEFAULT '[]',

    run_count           INTEGER NOT NULL DEFAULT 0,
    last_run_at         TIMESTAMPTZ,
    created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Các action type hợp lệ (documented dưới dạng constraint không thể enforce JSON, dùng app-level validation):
-- change_status | assign_user | set_priority | add_label | remove_label
-- send_notification | create_subtask | set_due_date | add_comment
-- move_to_sprint | call_webhook

CREATE INDEX IF NOT EXISTS idx_workflows_workspace ON public.workflows(workspace_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflows_project   ON public.workflows(project_id)   WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflows_trigger   ON public.workflows(trigger_type) WHERE is_active = true;

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền workflows" ON public.workflows FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon workflows"           ON public.workflows FOR ALL TO anon, authenticated USING (false);

CREATE TRIGGER update_workflows_updated_at
BEFORE UPDATE ON public.workflows
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── Workflow Runs (Lịch sử thực thi) ───────────────────
CREATE TABLE IF NOT EXISTS public.workflow_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id         UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
    task_id             UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    triggered_by        VARCHAR(100),               -- 'system', 'user:<id>', 'cron'
    status              VARCHAR(50) NOT NULL DEFAULT 'running'
                            CHECK (status IN ('running', 'success', 'failed', 'skipped', 'cancelled')),
    conditions_matched  BOOLEAN,
    actions_executed    JSONB NOT NULL DEFAULT '[]', -- [{type, status, result, error}]
    error_message       TEXT,
    duration_ms         INTEGER,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_task     ON public.workflow_runs(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status   ON public.workflow_runs(status) WHERE status = 'failed';

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền workflow_runs" ON public.workflow_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon workflow_runs"           ON public.workflow_runs FOR ALL TO anon, authenticated USING (false);


-- ─── Trigger: Cập nhật run_count và last_run_at sau mỗi lần chạy ─
CREATE OR REPLACE FUNCTION public.sync_workflow_run_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('success', 'failed') THEN
        UPDATE public.workflows
        SET run_count   = run_count + 1,
            last_run_at = NEW.completed_at
        WHERE id = NEW.workflow_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_workflow_run_count_trigger
AFTER UPDATE OF status ON public.workflow_runs
FOR EACH ROW EXECUTE FUNCTION public.sync_workflow_run_count();
