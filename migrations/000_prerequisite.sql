-- ========================================================
-- Migration: 000_prerequisite.sql
-- Mô tả: Các function tiện ích dùng chung cho toàn bộ schema
-- PHẢI CHẠY TRƯỚC TẤT CẢ MIGRATION KHÁC
-- ========================================================

-- Extension cần thiết
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";         -- gen_random_uuid() backup
CREATE EXTENSION IF NOT EXISTS "pg_trgm";           -- Fuzzy search (LIKE % nhanh hơn)
CREATE EXTENSION IF NOT EXISTS "btree_gist";        -- Dùng cho EXCLUDE constraint trong sprints

-- ─── Function updated_at (dùng lại từ setup.sql ban đầu) ─
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Function: Soft delete helper ───────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_task(p_task_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.tasks
    SET is_deleted = true,
        deleted_at = NOW()
    WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Function: Restore soft deleted task ────────────────
CREATE OR REPLACE FUNCTION public.restore_task(p_task_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.tasks
    SET is_deleted = false,
        deleted_at = NULL
    WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Function: Đệ quy lấy toàn bộ sub-tasks ────────────
CREATE OR REPLACE FUNCTION public.get_task_tree(p_task_id UUID)
RETURNS TABLE (
    id UUID,
    title VARCHAR,
    parent_task_id UUID,
    depth INTEGER
) AS $$
WITH RECURSIVE task_tree AS (
    SELECT t.id, t.title, t.parent_task_id, 0 AS depth
    FROM public.tasks t
    WHERE t.id = p_task_id AND t.is_deleted = false

    UNION ALL

    SELECT t.id, t.title, t.parent_task_id, tt.depth + 1
    FROM public.tasks t
    INNER JOIN task_tree tt ON tt.id = t.parent_task_id
    WHERE t.is_deleted = false
      AND tt.depth < 10    -- Giới hạn độ sâu tối đa 10 cấp
)
SELECT * FROM task_tree;
$$ LANGUAGE sql;
