const supabase = require('../config/supabase');

class AuthError extends Error {
  constructor(message, statusCode = 403) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function assertProjectMember(projectId, userId) {
  if (!projectId || !userId) throw new AuthError('Thieu thong tin project hoac user', 400);
  await module.exports.assertProjectRole(projectId, userId, ['owner', 'admin', 'member', 'viewer']);
}

async function assertTaskAccess(taskId, userId, action = 'view') {
  if (!taskId || !userId) throw new AuthError('Thieu thong tin task hoac user', 400);
  
  const { data: task, error } = await supabase
    .from('tasks')
    .select('id, creator_id, project_id, is_deleted')
    .eq('id', taskId)
    .single();

  if (error || !task || task.is_deleted) {
    throw new AuthError('Task khong ton tai hoac da bi xoa', 404);
  }

  const isCreator = task.creator_id === userId;
  if (isCreator) return true;
  
  await assertProjectMember(task.project_id, userId);
  return true;
}

async function assertTasksAccess(taskIds, userId, action = 'view') {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return true;
  
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, creator_id, project_id, is_deleted')
    .in('id', taskIds);

  if (error) throw new AuthError('Loi khi truy xuat tasks', 500);

  const foundTaskIds = new Set(tasks.filter(t => !t.is_deleted).map(t => t.id));
  for (const tid of taskIds) {
    if (!foundTaskIds.has(tid)) {
      throw new AuthError('Task ' + tid + ' khong ton tai hoac da bi xoa', 404);
    }
  }

  const projectIdsToCheck = new Set();
  for (const task of tasks) {
    if (task.creator_id !== userId) {
      projectIdsToCheck.add(task.project_id);
    }
  }

  for (const projectId of projectIdsToCheck) {
    await assertProjectMember(projectId, userId);
  }

  return true;
}

async function getTaskIdFromSubResource(resourceType, resourceId) {
  const tableMap = {
    'checklist_item': { table: 'task_checklist_items', fk: 'checklist_id' },
    'comment': { table: 'task_comments', fk: 'task_id' },
    'time_log': { table: 'time_logs', fk: 'task_id' }
  };
  
  const info = tableMap[resourceType];
  if (!info) throw new Error('Invalid resource type');

  const { data, error } = await supabase
    .from(info.table)
    .select(info.fk)
    .eq('id', resourceId)
    .single();

  if (error || !data) throw new AuthError(resourceType + ' khong ton tai', 404);

  let taskId = data[info.fk];

  if (resourceType === 'checklist_item') {
    const { data: clData, error: clError } = await supabase
      .from('task_checklists')
      .select('task_id')
      .eq('id', taskId)
      .single();
    if (clError || !clData) throw new AuthError('Checklist khong ton tai', 404);
    taskId = clData.task_id;
  }

  return taskId;
}

async function assertProjectRole(projectId, userId, allowedRoles = ['owner', 'admin', 'member', 'viewer']) {
  if (!projectId || !userId) throw new AuthError('Thieu thong tin project hoac user', 400);

  const { data: project, error: pError } = await supabase
    .from('projects').select('owner_id').eq('id', projectId).single();
  
  if (pError || !project) throw new AuthError('Project khong ton tai', 404);

  let userRole = null;
  if (project.owner_id === userId) {
    userRole = 'owner';
  } else {
    const { data: member, error: mError } = await supabase
      .from('project_members').select('role')
      .eq('project_id', projectId).eq('user_id', userId).single();

    if (mError || !member) throw new AuthError('Forbidden: Ban khong phai thanh vien du an', 403);
    userRole = member.role;
  }

  if (!allowedRoles.includes(userRole)) {
    throw new AuthError('Forbidden: Yeu cau role ' + allowedRoles.join(', '), 403);
  }

  return userRole;
}
module.exports = {
  assertProjectRole,
  AuthError,
  assertProjectMember,
  assertTaskAccess,
  assertTasksAccess,
  getTaskIdFromSubResource
};
