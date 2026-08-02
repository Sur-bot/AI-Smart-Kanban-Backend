-- ========================================================
-- Migration: 005_sprints.sql
-- Mô tả: Bảng sprints, kết nối sprint_id vào tasks
-- Phụ thuộc: 003_tasks_core.sql
-- ========================================================

-- ─── Sprints ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sprints (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,      -- "Sprint 1", "Q3-S2-2026"
    goal                TEXT,                        -- Mục tiêu sprint
    status              VARCHAR(50) NOT NULL DEFAULT 'planned'
                            CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    capacity_points     INTEGER,                     -- Story points dự kiến
    velocity            INTEGER,                     -- Points hoàn thành thực tế
    retrospective       JSONB DEFAULT '{}',          -- {"went_well": [], "improve": [], "action_items": []}
    created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    CONSTRAINT sprint_dates_valid CHECK (end_date > start_date),
    CONSTRAINT one_active_sprint EXCLUDE USING gist (
        project_id WITH =,
        daterange(start_date, end_date) WITH &&
    ) WHERE (status = 'active')
);

CREATE INDEX IF NOT EXISTS idx_sprints_project ON public.sprints(project_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_sprints_active  ON public.sprints(project_id) WHERE status = 'active';

ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền sprints" ON public.sprints FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon sprints"           ON public.sprints FOR ALL TO anon, authenticated USING (false);


-- ─── Kết nối FK sprint_id trong tasks ───────────────────
-- (sprint_id đã được khai báo trong 003, giờ thêm FK constraint)
ALTER TABLE public.tasks
    ADD CONSTRAINT IF NOT EXISTS tasks_sprint_id_fkey
    FOREIGN KEY (sprint_id) REFERENCES public.sprints(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON public.tasks(sprint_id)
    WHERE is_deleted = false AND sprint_id IS NOT NULL;


-- ─── Sprint Burndown Cache ───────────────────────────────
-- Lưu dữ liệu burndown theo ngày để vẽ chart nhanh
CREATE TABLE IF NOT EXISTS public.sprint_burndown (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id       UUID NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    remaining_points    INTEGER NOT NULL DEFAULT 0,
    completed_points    INTEGER NOT NULL DEFAULT 0,
    ideal_remaining     FLOAT,                  -- Đường lý tưởng
    tasks_completed     INTEGER NOT NULL DEFAULT 0,
    tasks_total         INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sprint_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_sprint_burndown ON public.sprint_burndown(sprint_id, snapshot_date ASC);

ALTER TABLE public.sprint_burndown ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Backend toàn quyền sprint_burndown" ON public.sprint_burndown FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Khóa anon sprint_burndown"           ON public.sprint_burndown FOR ALL TO anon, authenticated USING (false);


-- ─── Function: Tính toán burndown snapshot ──────────────
CREATE OR REPLACE FUNCTION public.calculate_sprint_burndown(p_sprint_id UUID, p_date DATE)
RETURNS void AS $$
DECLARE
    v_sprint        RECORD;
    v_total_points  INTEGER;
    v_done_points   INTEGER;
    v_remaining     INTEGER;
    v_days_total    INTEGER;
    v_days_elapsed  INTEGER;
    v_ideal_rate    FLOAT;
BEGIN
    SELECT * INTO v_sprint FROM public.sprints WHERE id = p_sprint_id;

    -- Tổng points trong sprint
    SELECT COALESCE(SUM(story_points), 0) INTO v_total_points
    FROM public.tasks
    WHERE sprint_id = p_sprint_id AND is_deleted = false;

    -- Points đã done tính đến ngày p_date
    SELECT COALESCE(SUM(t.story_points), 0) INTO v_done_points
    FROM public.tasks t
    JOIN public.task_statuses ts ON ts.id = t.status_id
    WHERE t.sprint_id = p_sprint_id
      AND t.is_deleted = false
      AND ts.category = 'done'
      AND DATE(t.completed_at) <= p_date;

    v_remaining := v_total_points - v_done_points;

    -- Tính ideal line
    v_days_total   := v_sprint.end_date - v_sprint.start_date;
    v_days_elapsed := p_date - v_sprint.start_date;
    IF v_days_total > 0 THEN
        v_ideal_rate := v_total_points::FLOAT * (1 - v_days_elapsed::FLOAT / v_days_total);
    ELSE
        v_ideal_rate := 0;
    END IF;

    INSERT INTO public.sprint_burndown
        (sprint_id, snapshot_date, remaining_points, completed_points, ideal_remaining)
    VALUES
        (p_sprint_id, p_date, v_remaining, v_done_points, GREATEST(0, v_ideal_rate))
    ON CONFLICT (sprint_id, snapshot_date) DO UPDATE SET
        remaining_points  = EXCLUDED.remaining_points,
        completed_points  = EXCLUDED.completed_points,
        ideal_remaining   = EXCLUDED.ideal_remaining;
END;
$$ LANGUAGE plpgsql;
