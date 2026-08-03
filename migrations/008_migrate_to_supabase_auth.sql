-- ========================================================
-- MIGRATION: Chuyển đổi từ public.users sang auth.users (Supabase Auth)
-- ⚠️  Chạy file này trong Supabase SQL Editor
-- Mục đích: Xóa bảng users tự tạo, cập nhật toàn bộ FK sang auth.users
-- ========================================================

-- BƯỚC 0: Xóa sạch toàn bộ dữ liệu nghiệp vụ cũ (data test, data từ public.users cũ)
-- CASCADE sẽ xóa các bảng liên quan theo thứ tự FK tự động
-- ─────────────────────────────────────────────────────────
TRUNCATE TABLE
    public.task_custom_field_values,
    public.custom_fields,
    public.notifications,
    public.performance_snapshots,
    public.workflow_runs,
    public.workflows,
    public.task_activities,
    public.time_logs,
    public.task_attachments,
    public.task_comments,
    public.task_checklist_items,
    public.task_checklists,
    public.task_dependencies,
    public.task_labels,
    public.task_assignees,
    public.tasks,
    public.sprint_burndown,
    public.sprints,
    public.task_statuses,
    public.labels,
    public.project_members,
    public.projects,
    public.workspaces
CASCADE;

-- BƯỚC 1: Xóa bảng users cũ (phải xóa FK constraints trước)
-- ─────────────────────────────────────────────────────────

-- 1.1 Cập nhật FK trong workspaces
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 1.2 Cập nhật FK trong projects
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_owner_id_fkey;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 1.3 Cập nhật FK trong project_members
ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;
ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 1.4 Cập nhật FK trong labels
ALTER TABLE public.labels
  DROP CONSTRAINT IF EXISTS labels_created_by_fkey;
ALTER TABLE public.labels
  ADD CONSTRAINT labels_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1.5 Cập nhật FK trong tasks (creator_id, assignee_id)
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_creator_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1.6 Cập nhật FK trong task_assignees
ALTER TABLE public.task_assignees
  DROP CONSTRAINT IF EXISTS task_assignees_user_id_fkey;
ALTER TABLE public.task_assignees
  ADD CONSTRAINT task_assignees_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.task_assignees
  DROP CONSTRAINT IF EXISTS task_assignees_assigned_by_fkey;
ALTER TABLE public.task_assignees
  ADD CONSTRAINT task_assignees_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1.7 Cập nhật FK trong task_labels
ALTER TABLE public.task_labels
  DROP CONSTRAINT IF EXISTS task_labels_tagged_by_fkey;
ALTER TABLE public.task_labels
  ADD CONSTRAINT task_labels_tagged_by_fkey
  FOREIGN KEY (tagged_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1.8 Cập nhật FK trong task_checklist_items
ALTER TABLE public.task_checklist_items
  DROP CONSTRAINT IF EXISTS task_checklist_items_assignee_id_fkey;
ALTER TABLE public.task_checklist_items
  ADD CONSTRAINT task_checklist_items_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.task_checklist_items
  DROP CONSTRAINT IF EXISTS task_checklist_items_completed_by_fkey;
ALTER TABLE public.task_checklist_items
  ADD CONSTRAINT task_checklist_items_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1.9 Cập nhật FK trong task_comments
ALTER TABLE public.task_comments
  DROP CONSTRAINT IF EXISTS task_comments_author_id_fkey;
ALTER TABLE public.task_comments
  ADD CONSTRAINT task_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 1.10 Cập nhật FK trong task_attachments
ALTER TABLE public.task_attachments
  DROP CONSTRAINT IF EXISTS task_attachments_uploaded_by_fkey;
ALTER TABLE public.task_attachments
  ADD CONSTRAINT task_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 1.11 Cập nhật FK trong time_logs
ALTER TABLE public.time_logs
  DROP CONSTRAINT IF EXISTS time_logs_user_id_fkey;
ALTER TABLE public.time_logs
  ADD CONSTRAINT time_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 1.12 Cập nhật FK trong task_activities
ALTER TABLE public.task_activities
  DROP CONSTRAINT IF EXISTS task_activities_actor_id_fkey;
ALTER TABLE public.task_activities
  ADD CONSTRAINT task_activities_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 1.13 Cập nhật FK trong sprints
ALTER TABLE public.sprints
  DROP CONSTRAINT IF EXISTS sprints_created_by_fkey;
ALTER TABLE public.sprints
  ADD CONSTRAINT sprints_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1.14 Cập nhật FK trong workflows
ALTER TABLE public.workflows
  DROP CONSTRAINT IF EXISTS workflows_created_by_fkey;
ALTER TABLE public.workflows
  ADD CONSTRAINT workflows_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1.15 Cập nhật FK trong performance_snapshots
ALTER TABLE public.performance_snapshots
  DROP CONSTRAINT IF EXISTS performance_snapshots_user_id_fkey;
ALTER TABLE public.performance_snapshots
  ADD CONSTRAINT performance_snapshots_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 1.16 Cập nhật FK trong notifications
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- BƯỚC 2: Xóa bảng public.users cũ (đã không còn FK nào tham chiếu tới)
-- ─────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.users CASCADE;

-- BƯỚC 3: Tạo View public.users (view proxy) để dùng thông tin user tiện hơn trong báo cáo
-- View này kéo thông tin từ auth.users + user_metadata
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.user_profiles AS
  SELECT
    id,
    email,
    raw_user_meta_data->>'full_name'  AS name,
    raw_user_meta_data->>'avatar_url' AS avatar_url,
    created_at,
    last_sign_in_at
  FROM auth.users;

-- Chỉ backend (service_role) được đọc view này
GRANT SELECT ON public.user_profiles TO service_role;

-- ========================================================
-- ✅ MIGRATION HOÀN TẤT
-- Tất cả FK đã chuyển sang auth.users
-- Bảng public.users đã được xóa an toàn
-- View public.user_profiles sẵn sàng để JOIN
-- ========================================================
