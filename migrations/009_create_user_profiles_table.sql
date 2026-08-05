-- ========================================================
-- MIGRATION 009: Create public.user_profiles table
-- Purpose: Replace VIEW with real TABLE so PostgREST can
--          resolve FK-based embedded joins (fixes PGRST200)
-- Run this in Supabase SQL Editor
-- ========================================================

-- STEP 1: Drop the existing VIEW (created in migration 008)
DROP VIEW IF EXISTS public.user_profiles;

-- STEP 2: Create user_profiles as a real TABLE
-- id references auth.users so Supabase Auth owns the lifecycle
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  name        TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend full access user_profiles"
  ON public.user_profiles FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- STEP 3: Trigger function — auto-sync auth.users → user_profiles
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    name       = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_or_updated ON auth.users;
CREATE TRIGGER on_auth_user_created_or_updated
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();

-- STEP 4: Seed existing auth.users into user_profiles
INSERT INTO public.user_profiles (id, email, name, avatar_url)
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- STEP 5: Re-point all FK constraints from auth.users → public.user_profiles
-- (PostgREST can only join through FKs in the public schema)

-- 5.1 tasks
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_creator_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES public.user_profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 5.2 task_assignees
ALTER TABLE public.task_assignees
  DROP CONSTRAINT IF EXISTS task_assignees_user_id_fkey;
ALTER TABLE public.task_assignees
  ADD CONSTRAINT task_assignees_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.task_assignees
  DROP CONSTRAINT IF EXISTS task_assignees_assigned_by_fkey;
ALTER TABLE public.task_assignees
  ADD CONSTRAINT task_assignees_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 5.3 task_labels
ALTER TABLE public.task_labels
  DROP CONSTRAINT IF EXISTS task_labels_tagged_by_fkey;
ALTER TABLE public.task_labels
  ADD CONSTRAINT task_labels_tagged_by_fkey
  FOREIGN KEY (tagged_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 5.4 task_checklist_items
ALTER TABLE public.task_checklist_items
  DROP CONSTRAINT IF EXISTS task_checklist_items_assignee_id_fkey;
ALTER TABLE public.task_checklist_items
  ADD CONSTRAINT task_checklist_items_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.task_checklist_items
  DROP CONSTRAINT IF EXISTS task_checklist_items_completed_by_fkey;
ALTER TABLE public.task_checklist_items
  ADD CONSTRAINT task_checklist_items_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 5.5 task_comments
ALTER TABLE public.task_comments
  DROP CONSTRAINT IF EXISTS task_comments_author_id_fkey;
ALTER TABLE public.task_comments
  ADD CONSTRAINT task_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.user_profiles(id) ON DELETE RESTRICT;

-- 5.6 task_attachments
ALTER TABLE public.task_attachments
  DROP CONSTRAINT IF EXISTS task_attachments_uploaded_by_fkey;
ALTER TABLE public.task_attachments
  ADD CONSTRAINT task_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.user_profiles(id) ON DELETE RESTRICT;

-- 5.7 time_logs
ALTER TABLE public.time_logs
  DROP CONSTRAINT IF EXISTS time_logs_user_id_fkey;
ALTER TABLE public.time_logs
  ADD CONSTRAINT time_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE RESTRICT;

-- 5.8 task_activities
ALTER TABLE public.task_activities
  DROP CONSTRAINT IF EXISTS task_activities_actor_id_fkey;
ALTER TABLE public.task_activities
  ADD CONSTRAINT task_activities_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.user_profiles(id) ON DELETE RESTRICT;

-- 5.9 workspaces
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.user_profiles(id) ON DELETE RESTRICT;

-- 5.10 projects
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_owner_id_fkey;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.user_profiles(id) ON DELETE RESTRICT;

-- 5.11 project_members
ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;
ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- 5.12 labels
ALTER TABLE public.labels
  DROP CONSTRAINT IF EXISTS labels_created_by_fkey;
ALTER TABLE public.labels
  ADD CONSTRAINT labels_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 5.13 sprints
ALTER TABLE public.sprints
  DROP CONSTRAINT IF EXISTS sprints_created_by_fkey;
ALTER TABLE public.sprints
  ADD CONSTRAINT sprints_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 5.14 workflows
ALTER TABLE public.workflows
  DROP CONSTRAINT IF EXISTS workflows_created_by_fkey;
ALTER TABLE public.workflows
  ADD CONSTRAINT workflows_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 5.15 performance_snapshots
ALTER TABLE public.performance_snapshots
  DROP CONSTRAINT IF EXISTS performance_snapshots_user_id_fkey;
ALTER TABLE public.performance_snapshots
  ADD CONSTRAINT performance_snapshots_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- 5.16 notifications
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- ========================================================
-- MIGRATION COMPLETE
-- public.user_profiles is now a real TABLE synced from auth.users
-- All FK constraints updated to point to public.user_profiles
-- PostgREST can now resolve embedded joins via user_profiles!<col>
-- ========================================================
