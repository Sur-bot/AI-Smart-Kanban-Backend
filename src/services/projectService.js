const supabase = require('../config/supabase');

/**
 * Lấy hoặc tự động tạo Không gian làm việc mặc định cho User
 */
async function getOrCreateDefaultWorkspace(userId) {
  // 1. Kiểm tra workspace hiện có của user
  const { data: existing, error: findError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (findError) throw findError;
  if (existing && existing.length > 0) {
    return existing[0];
  }

  // 2. Nếu chưa có, tạo Không gian mặc định
  const slug = `workspace-${userId.substring(0, 8)}-${Date.now().toString(36)}`;
  const { data: created, error: createError } = await supabase
    .from('workspaces')
    .insert([{
      name: 'Không gian cá nhân',
      slug: slug,
      owner_id: userId,
      settings: {}
    }])
    .select()
    .single();

  if (createError) throw createError;
  return created;
}

/**
 * Lấy hoặc tự động tạo Dự án mặc định trong Workspace
 */
async function getOrCreateDefaultProject(workspaceId, userId) {
  // 1. Tìm project đầu tiên trong workspace
  const { data: existing, error: findError } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1);

  if (findError) throw findError;
  if (existing && existing.length > 0) {
    return existing[0];
  }

  // 2. Tạo dự án mặc định
  const { data: created, error: createError } = await supabase
    .from('projects')
    .insert([{
      workspace_id: workspaceId,
      name: 'Dự án mặc định',
      description: 'Dự án mặc định để quản lý công việc và tác vụ của bạn',
      color: '#3b82f6',
      icon: 'folder',
      owner_id: userId,
      status: 'active',
      is_public: false
    }])
    .select()
    .single();

  if (createError) throw createError;

  // 3. Thêm owner vào project_members
  await supabase
    .from('project_members')
    .insert([{
      project_id: created.id,
      user_id: userId,
      role: 'owner'
    }]);

  // 4. Khởi tạo bộ trạng thái mặc định (seed_default_statuses)
  await supabase.rpc('seed_default_statuses', { p_project_id: created.id });

  return created;
}

/**
 * Lấy danh sách dự án của người dùng
 */
async function getUserProjects(userId, workspaceId = null) {
  let query = supabase
    .from('projects')
    .select(`
      id,
      workspace_id,
      name,
      description,
      status,
      color,
      icon,
      cover_url,
      owner_id,
      start_date,
      end_date,
      is_public,
      created_at,
      project_members (
        user_id,
        role
      )
    `)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Lấy danh sách trạng thái của dự án (theo thứ tự sort_order)
 */
async function getProjectStatuses(projectId) {
  const { data, error } = await supabase
    .from('task_statuses')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  // Nếu dự án chưa có status nào, tự động seed
  if (!data || data.length === 0) {
    await supabase.rpc('seed_default_statuses', { p_project_id: projectId });
    const { data: seeded } = await supabase
      .from('task_statuses')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    return seeded || [];
  }

  return data;
}

/**
 * Tạo dự án mới
 */
async function createProject(projectData, userId) {
  const {
    workspaceId,
    name,
    description = '',
    color = '#3b82f6',
    icon = 'folder',
    startDate = null,
    endDate = null,
    isPublic = false
  } = projectData;

  let targetWorkspaceId = workspaceId;
  if (!targetWorkspaceId) {
    const ws = await getOrCreateDefaultWorkspace(userId);
    targetWorkspaceId = ws.id;
  }

  // 1. Tạo project
  const { data: project, error: createError } = await supabase
    .from('projects')
    .insert([{
      workspace_id: targetWorkspaceId,
      name,
      description,
      color,
      icon,
      start_date: startDate,
      end_date: endDate,
      is_public: isPublic,
      owner_id: userId,
      status: 'active'
    }])
    .select()
    .single();

  if (createError) throw createError;

  // 2. Gán thành viên owner
  await supabase
    .from('project_members')
    .insert([{
      project_id: project.id,
      user_id: userId,
      role: 'owner'
    }]);

  // 3. Khởi tạo statuses
  await supabase.rpc('seed_default_statuses', { p_project_id: project.id });

  return project;
}


async function getProjectLabels(projectId) {
  const { data, error } = await supabase
    .from('labels')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function createLabel(projectId, labelData) {
  const { name, color } = labelData;
  if (!name) throw new Error('Tên nhãn không được để trống');
  const { data, error } = await supabase
    .from('labels')
    .insert([{ project_id: projectId, name: name.trim(), color: color || '#e2e8f0' }])
    .select()
    .single();
  if (error) throw error;
  return data;
}


async function getProjectMembers(projectId) {
  const { data, error } = await supabase
    .from('project_members')
    .select(`
      id,
      role,
      job_role,
      user_id,
      created_at,
      user:user_profiles!user_id(id, name, email, avatar_url)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}


async function createProjectStatus(projectId, statusData) {
  const { name, color, sortOrder, sort_order } = statusData;
  const order = sortOrder !== undefined ? sortOrder : sort_order;
  const { data, error } = await supabase
    .from('task_statuses')
    .insert([{ project_id: projectId, name, color, sort_order: order }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateProjectStatus(projectId, statusId, statusData) {
  const { name, color, sortOrder, sort_order } = statusData;
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (color !== undefined) payload.color = color;
  const order = sortOrder !== undefined ? sortOrder : sort_order;
  if (order !== undefined) payload.sort_order = order;
  
  const { data, error } = await supabase
    .from('task_statuses')
    .update(payload)
    .eq('id', statusId)
    .eq('project_id', projectId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteProjectStatus(projectId, statusId, newStatusId) {
  if (newStatusId) {
    await supabase.from('tasks').update({ status_id: newStatusId }).eq('status_id', statusId);
  }
  const { error } = await supabase.from('task_statuses').delete().eq('id', statusId).eq('project_id', projectId);
  if (error) throw error;
  return { success: true };
}


/**
 * Them thanh vien vao du an
 */
async function addMemberToProject(projectId, { userId, role = 'member', jobRole = null }) {
  const VALID_JOB_ROLES = ['PM', 'FE', 'BE', 'QA', 'DevOps', 'Designer', 'Mobile', 'DataAnalyst', 'Other'];
  if (jobRole && !VALID_JOB_ROLES.includes(jobRole)) {
    throw new Error(`job_role khong hop le. Cac gia tri cho phep: ${VALID_JOB_ROLES.join(', ')}`);
  }
  const { data, error } = await supabase
    .from('project_members')
    .insert([{ project_id: projectId, user_id: userId, role, job_role: jobRole }])
    .select(`
      id,
      role,
      job_role,
      user_id,
      created_at,
      user:user_profiles!user_id(id, name, email, avatar_url)
    `)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Cap nhat job_role cua mot thanh vien trong du an
 */
async function updateMemberJobRole(projectId, memberId, jobRole) {
  const VALID_JOB_ROLES = ['PM', 'FE', 'BE', 'QA', 'DevOps', 'Designer', 'Mobile', 'DataAnalyst', 'Other'];
  if (jobRole !== null && !VALID_JOB_ROLES.includes(jobRole)) {
    throw new Error(`job_role khong hop le. Cac gia tri cho phep: ${VALID_JOB_ROLES.join(', ')}`);
  }
  const { data, error } = await supabase
    .from('project_members')
    .update({ job_role: jobRole })
    .eq('id', memberId)
    .eq('project_id', projectId)
    .select(`
      id,
      role,
      job_role,
      user_id,
      user:user_profiles!user_id(id, name, email, avatar_url)
    `)
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  createProjectStatus,
  updateProjectStatus,
  deleteProjectStatus,
  getProjectMembers,
  addMemberToProject,
  updateMemberJobRole,
  getProjectLabels,
  createLabel,
  getOrCreateDefaultWorkspace,
  getOrCreateDefaultProject,
  getUserProjects,
  getProjectStatuses,
  createProject
};



