const supabase = require('../config/supabase');
const projectService = require('./projectService');
const authService = require('./authService');

/**
 * Lấy danh sách Tác vụ theo bộ lọc linh hoạt
 */
async function getTasks(filters = {}, userId) {
  const {
    workspaceId,
    projectId,
    sprintId,
    statusId,
    statusIds,
    priority,
    priorities,
    assigneeId,
    role = 'all',
    isOverdue,
    dueDateFrom,
    dueDateTo,
    search,
    parentTaskId,
    onlyRootTasks = false,
    sortBy = 'created_at',
    sortDir = 'desc',
    page = 1,
    limit = 50
  } = filters;

  // 1. Xác định Workspace nếu chưa truyền
  let targetWorkspaceId = workspaceId;
  if (!targetWorkspaceId && !projectId) {
    const ws = await projectService.getOrCreateDefaultWorkspace(userId);
    targetWorkspaceId = ws.id;
  }

  if (projectId) {
    await authService.assertProjectMember(projectId, userId);
  } else {
    const { data: ownedProjects } = await supabase.from('projects').select('id').eq('owner_id', userId);
    const { data: memberProjects } = await supabase.from('project_members').select('project_id').eq('user_id', userId);
    
    var allowedProjectIds = [
      ...(ownedProjects || []).map(p => p.id),
      ...(memberProjects || []).map(p => p.project_id)
    ];

    if (allowedProjectIds.length === 0) {
      return { tasks: [], total: 0, page: Number(page), limit: Number(limit), totalPages: 0 };
    }
    
    }

  // 2. Xây dựng truy vấn
  let query = supabase
    .from('tasks')
    .select(`
      id,
      workspace_id,
      project_id,
      parent_task_id,
      status_id,
      title,
      description,
      priority,
      task_type,
      start_date,
      due_date,
      completed_at,
      creator_id,
      assignee_id,
      job_role,
      estimated_minutes,
      actual_minutes,
      story_points,
      sprint_id,
      sort_order,
      board_column_order,
      ai_risk_score,
      ai_summary,
      ai_tags,
      created_at,
      updated_at,
      status:task_statuses(id, name, color, category, sort_order),
      creator:user_profiles!creator_id(id, name, email, avatar_url),
      assignee:user_profiles!assignee_id(id, name, email, avatar_url),
      task_assignees(
        user_id,
        user:user_profiles!task_assignees_user_id_fkey(id, name, email, avatar_url)
      ),
      task_labels(
        label_id,
        label:labels(id, name, color)
      ),
      task_checklists(
        id,
        task_checklist_items(id, is_done)
      ),
      task_comments(id)
    `, { count: 'exact' })
    .eq('is_deleted', false)
    .eq('is_archived', false);

  if (targetWorkspaceId) {
    query = query.eq('workspace_id', targetWorkspaceId);
  }
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  if (sprintId) {
    query = query.eq('sprint_id', sprintId);
  }

  // Lọc theo Status
  if (statusIds && Array.isArray(statusIds) && statusIds.length > 0) {
    query = query.in('status_id', statusIds);
  } else if (statusId) {
    query = query.eq('status_id', statusId);
  }

  // Lọc theo Priority
  if (priorities && Array.isArray(priorities) && priorities.length > 0) {
    query = query.in('priority', priorities);
  } else if (priority) {
    query = query.eq('priority', priority);
  }

  // Lọc theo Vai trò
  if (role === 'mine' || role === 'assigned_to_me') {
    query = query.eq('assignee_id', userId);
  } else if (role === 'created_by_me') {
    query = query.eq('creator_id', userId);
  } else if (assigneeId) {
    query = query.eq('assignee_id', assigneeId);
  }

  // Lọc quá hạn
  if (isOverdue === true || isOverdue === 'true') {
    const nowIso = new Date().toISOString();
    query = query.lt('due_date', nowIso).is('completed_at', null);
  }

  // Lọc theo khoảng ngày hết hạn
  if (dueDateFrom) {
    query = query.gte('due_date', dueDateFrom);
  }
  if (dueDateTo) {
    query = query.lte('due_date', dueDateTo);
  }

  // Lọc Subtask / Task gốc
  if (parentTaskId) {
    query = query.eq('parent_task_id', parentTaskId);
  } else if (onlyRootTasks === true || onlyRootTasks === 'true') {
    query = query.is('parent_task_id', null);
  }

  // Tìm kiếm theo từ khóa
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
  }

  // Sắp xếp
  const ascending = sortDir.toLowerCase() === 'asc';
  query = query.order(sortBy, { ascending });

    if (!projectId && allowedProjectIds) {
      query = query.in('project_id', allowedProjectIds);
    }

  // Phân trang
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  // 3. Biến đổi dữ liệu sang định dạng phẳng gọn gàng
  const formattedTasks = (data || []).map(task => {
    // Tính toán tiến độ checklist
    let checklistTotal = 0;
    let checklistDone = 0;
    if (task.task_checklists) {
      task.task_checklists.forEach(cl => {
        if (cl.task_checklist_items) {
          checklistTotal += cl.task_checklist_items.length;
          checklistDone += cl.task_checklist_items.filter(item => item.is_done).length;
        }
      });
    }

    // Danh sách người nhận phụ + chính
    const assignees = (task.task_assignees || [])
      .map(ta => ta.user)
      .filter(Boolean);

    // Danh sách nhãn
    const labels = (task.task_labels || [])
      .map(tl => tl.label)
      .filter(Boolean);

    return {
      id: task.id,
      workspaceId: task.workspace_id,
      projectId: task.project_id,
      parentTaskId: task.parent_task_id,
      statusId: task.status_id,
      status: task.status,
      title: task.title,
      description: task.description,
      priority: task.priority,
      taskType: task.task_type,
      startDate: task.start_date,
      dueDate: task.due_date,
      completedAt: task.completed_at,
      creatorId: task.creator_id,
      creator: task.creator,
      assigneeId: task.assignee_id,
      assignee: task.assignee,
      assignees: assignees.length > 0 ? assignees : (task.assignee ? [task.assignee] : []),
      jobRole: task.job_role || null,
      labels: labels,
      estimatedMinutes: task.estimated_minutes,
      actualMinutes: task.actual_minutes,
      storyPoints: task.story_points,
      sprintId: task.sprint_id,
      sortOrder: task.sort_order,
      boardColumnOrder: task.board_column_order,
      aiRiskScore: task.ai_risk_score,
      aiSummary: task.ai_summary,
      aiTags: task.ai_tags,
      checklistCount: checklistTotal,
      checklistDoneCount: checklistDone,
      commentCount: task.task_comments ? task.task_comments.length : 0,
      createdAt: task.created_at,
      updatedAt: task.updated_at
    };
  });

  return {
    tasks: formattedTasks,
    total: count || 0,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil((count || 0) / limit)
  };
}

/**
 * Lấy chi tiết tác vụ đầy đủ (Full Detail View)
 */
async function getTaskById(taskId, userId) {
  await authService.assertTaskAccess(taskId, userId, 'view');
  const { data: task, error } = await supabase
    .from('tasks')
    .select(`
      *,
      status:task_statuses(*),
      creator:user_profiles!creator_id(id, name, email, avatar_url),
      assignee:user_profiles!assignee_id(id, name, email, avatar_url),
      task_assignees(
        user_id,
        user:user_profiles!task_assignees_user_id_fkey(id, name, email, avatar_url)
      ),
      task_labels(
        label_id,
        label:labels(id, name, color)
      ),
      task_checklists(
        id,
        title,
        sort_order,
        task_checklist_items(
          id,
          text,
          is_done,
          assignee_id,
          due_date,
          sort_order,
          completed_at,
          assignee:user_profiles!task_checklist_items_assignee_id_fkey(id, name, avatar_url)
        )
      ),
      task_comments(
        id,
        author_id,
        parent_comment_id,
        content,
        content_json,
        is_edited,
        reactions,
        created_at,
        updated_at,
        author:user_profiles!author_id(id, name, email, avatar_url)
      ),
      task_attachments(
        id,
        file_name,
        storage_key,
        thumbnail_key,
        file_size,
        mime_type,
        created_at,
        uploaded_by:user_profiles!uploaded_by(id, name)
      ),
      time_logs(
        id,
        user_id,
        started_at,
        ended_at,
        duration_minutes,
        note,
        is_billable,
        logged_at,
        user:user_profiles!user_id(id, name, avatar_url)
      ),
      task_activities(
        id,
        action,
        field,
        old_value,
        new_value,
        metadata,
        created_at,
        actor:user_profiles!actor_id(id, name, avatar_url)
      ),
      subtasks:tasks!parent_task_id(
        id,
        title,
        priority,
        due_date,
        completed_at,
        status:task_statuses(id, name, color, category),
        assignee:user_profiles!assignee_id(id, name, avatar_url)
      )
    `)
    .eq('id', taskId)
    .eq('is_deleted', false)
    .single();

  if (error) throw error;
  if (!task) return null;

  return task;
}

/**
 * Tạo Tác vụ mới (tự động gán Workspace, Project, Status mặc định nếu thiếu)
 */
async function createTask(taskData, userId) {
  let {
    workspaceId,
    projectId,
    statusId,
    parentTaskId = null,
    title,
    description = '',
    descriptionJson = null,
    priority = 'medium',
    taskType = 'task',
    startDate = null,
    dueDate = null,
    assigneeId = null,
    assigneeIds = [],
    labelIds = [],
    estimatedMinutes = null,
    storyPoints = null,
    sprintId = null,
    sortOrder = 0,
    boardColumnOrder = 0
  } = taskData;

  if (!title || !title.trim()) {
    throw new Error('Tiêu đề tác vụ không được để trống');
  }

  // 1. Resolve Workspace
  let targetWorkspaceId = workspaceId;
  if (!targetWorkspaceId) {
    const ws = await projectService.getOrCreateDefaultWorkspace(userId);
    targetWorkspaceId = ws.id;
  }

  // 2. Resolve Project
  let targetProjectId = projectId;
  if (!targetProjectId) {
    const proj = await projectService.getOrCreateDefaultProject(targetWorkspaceId, userId);
    targetProjectId = proj.id;
  }

  await authService.assertProjectMember(targetProjectId, userId);

  // 3. Resolve Status
  let targetStatusId = statusId;
  if (!targetStatusId) {
    const statuses = await projectService.getProjectStatuses(targetProjectId, userId);
    const defaultStatus = statuses.find(s => s.is_default) || statuses[0];
    if (!defaultStatus) {
      throw new Error('Không tìm thấy trạng thái hợp lệ cho dự án');
    }
    targetStatusId = defaultStatus.id;
  }

  // 3.5. Validate assignees are project members
  const allAssigneeIds = [...(assigneeIds || [])];
  if (assigneeId && !allAssigneeIds.includes(assigneeId)) {
    allAssigneeIds.push(assigneeId);
  }
  if (allAssigneeIds.length > 0) {
    for (const aId of allAssigneeIds) {
      const isMember = await projectService.isProjectMember(targetProjectId, aId);
      if (!isMember) {
        throw new Error(`User ${aId} is not a member of this project. Cannot assign task.`);
      }
    }
  }

  // 4. Insert Task

  const { data: createdTask, error: insertError } = await supabase
    .from('tasks')
    .insert([{
      workspace_id: targetWorkspaceId,
      project_id: targetProjectId,
      parent_task_id: parentTaskId,
      status_id: targetStatusId,
      title: title.trim(),
      description,
      description_json: descriptionJson,
      priority,
      task_type: taskType,
      start_date: startDate,
      due_date: dueDate,
      creator_id: userId,
      assignee_id: assigneeId || (assigneeIds.length > 0 ? assigneeIds[0] : null),
      estimated_minutes: estimatedMinutes,
      story_points: storyPoints,
      sprint_id: sprintId,
      sort_order: sortOrder,
      board_column_order: boardColumnOrder
    }])
    .select(`
      *,
      status:task_statuses(id, name, color, category),
      creator:user_profiles!creator_id(id, name, email, avatar_url),
      assignee:user_profiles!assignee_id(id, name, email, avatar_url)
    `)
    .single();

  if (insertError) throw insertError;

  // 5. Gán người nhận phụ nếu có
  if (assigneeIds && assigneeIds.length > 0) {
    const assigneeRows = assigneeIds.map(uid => ({
      task_id: createdTask.id,
      user_id: uid,
      assigned_by: userId
    }));
    await supabase.from('task_assignees').insert(assigneeRows);
  }

  // 6. Gán nhãn nếu có
  if (labelIds && labelIds.length > 0) {
    const labelRows = labelIds.map(lid => ({
      task_id: createdTask.id,
      label_id: lid,
      tagged_by: userId
    }));
    await supabase.from('task_labels').insert(labelRows);
  }

  return createdTask;
}

/**
 * Cập nhật Tác vụ
 */
async function updateTask(taskId, updateData, userId) {
  await authService.assertTaskAccess(taskId, userId, 'edit');
  // Map camelCase (from Angular frontend) -> snake_case (PostgreSQL columns)
  const camelToSnake = {
    statusId:          'status_id',
    priority:          'priority',
    taskType:          'task_type',
    title:             'title',
    description:       'description',
    descriptionJson:   'description_json',
    startDate:         'start_date',
    dueDate:           'due_date',
    assigneeId:        'assignee_id',
    estimatedMinutes:  'estimated_minutes',
    actualMinutes:     'actual_minutes',
    storyPoints:       'story_points',
    sprintId:          'sprint_id',
    sortOrder:         'sort_order',
    boardColumnOrder:  'board_column_order',
    isArchived:        'is_archived',
    projectId:         'project_id',
    parentTaskId:      'parent_task_id',
    // snake_case fallback (direct DB field names still accepted)
    status_id:         'status_id',
    task_type:         'task_type',
    start_date:        'start_date',
    due_date:          'due_date',
    assignee_id:       'assignee_id',
    estimated_minutes: 'estimated_minutes',
    actual_minutes:    'actual_minutes',
    story_points:      'story_points',
    sprint_id:         'sprint_id',
    sort_order:        'sort_order',
    board_column_order:'board_column_order',
    is_archived:       'is_archived',
    project_id:        'project_id',
    parent_task_id:    'parent_task_id',
    description_json:  'description_json'
  };

  const payload = {};
  for (const [key, dbField] of Object.entries(camelToSnake)) {
    if (updateData[key] !== undefined) {
      payload[dbField] = updateData[key];
    }
  }
  // completedAt: set completed_at when marking as done
  if (updateData.completedAt !== undefined) {
    payload['completed_at'] = updateData.completedAt;
  }

  if (Object.keys(payload).length > 0) {
    const { error: updateError } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', taskId)
      .eq('is_deleted', false);

    if (updateError) throw updateError;
  }

  // Cập nhật người nhận nếu có truyền
  if (updateData.assigneeIds && Array.isArray(updateData.assigneeIds)) {
    await supabase.from('task_assignees').delete().eq('task_id', taskId);
    if (updateData.assigneeIds.length > 0) {
      const rows = updateData.assigneeIds.map(uid => ({
        task_id: taskId,
        user_id: uid,
        assigned_by: userId
      }));
      await supabase.from('task_assignees').insert(rows);
    }
  }

  // Cập nhật nhãn nếu có truyền
  if (updateData.labelIds && Array.isArray(updateData.labelIds)) {
    await supabase.from('task_labels').delete().eq('task_id', taskId);
    if (updateData.labelIds.length > 0) {
      const rows = updateData.labelIds.map(lid => ({
        task_id: taskId,
        label_id: lid,
        tagged_by: userId
      }));
      await supabase.from('task_labels').insert(rows);
    }
  }

  return getTaskById(taskId, userId);
}

/**
 * Xóa mềm Tác vụ
 */
async function deleteTask(taskId, userId) {
  await authService.assertTaskAccess(taskId, userId, 'delete');
  const { error } = await supabase
    .from('tasks')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString()
    })
    .eq('id', taskId);

  if (error) throw error;
  return { success: true, message: 'Đã xóa tác vụ thành công' };
}

/**
 * Xóa mềm nhiều Tác vụ cùng lúc (Bulk Delete)
 */
async function bulkDeleteTasks(taskIds, userId) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    throw new Error('Danh sách ID không hợp lệ');
  }
  await authService.assertTasksAccess(taskIds, userId, 'delete');
  const { error } = await supabase
    .from('tasks')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .in('id', taskIds);
  if (error) throw error;
  return { success: true, count: taskIds.length };
}

/**
 * Cập nhật nhiều tác vụ cùng lúc
 */
async function bulkUpdateTasks(taskIds, payload, userId) {
  await authService.assertTasksAccess(taskIds, userId, 'edit');
  const allowedFields = ['status_id', 'priority', 'assignee_id', 'pipeline_status'];
  const updateData = {};
  allowedFields.forEach(f => {
    if (payload[f] !== undefined) updateData[f] = payload[f];
  });
  if (Object.keys(updateData).length === 0) {
    throw new Error('Không có trường hợp lệ để cập nhật');
  }
  updateData.updated_at = new Date().toISOString();
  
  const { error } = await supabase.from('tasks').update(updateData).in('id', taskIds);
  if (error) throw error;
  return { success: true, count: taskIds.length };
}

/**
 * Thêm Bình luận vào Tác vụ
 */
async function addComment(taskId, commentData, userId) {
  await authService.assertTaskAccess(taskId, userId, 'comment');
  const { content, contentJson = null, parentCommentId = null } = commentData;
  if (!content || !content.trim()) {
    throw new Error('Nội dung bình luận không được để trống');
  }

  const { data, error } = await supabase
    .from('task_comments')
    .insert([{
      task_id: taskId,
      author_id: userId,
      parent_comment_id: parentCommentId,
      content: content.trim(),
      content_json: contentJson
    }])
    .select(`
      *,
      author:user_profiles!author_id(id, name, email, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Tạo Checklist và các mục con
 */
async function createChecklist(taskId, checklistData, userId) {
  await authService.assertTaskAccess(taskId, userId, 'edit');
  const { title = 'Danh sách công việc', items = [] } = checklistData;

  const { data: checklist, error: clError } = await supabase
    .from('task_checklists')
    .insert([{
      task_id: taskId,
      title: title.trim()
    }])
    .select()
    .single();

  if (clError) throw clError;

  if (items.length > 0) {
    const itemRows = items.map((item, idx) => ({
      checklist_id: checklist.id,
      text: typeof item === 'string' ? item : item.text,
      sort_order: idx,
      is_done: false
    }));
    await supabase.from('task_checklist_items').insert(itemRows);
  }

  return getTaskById(taskId, userId);
}

/**
 * Đổi trạng thái mục Checklist
 */
async function toggleChecklistItem(itemId, isDone, userId) {
  const taskId = await authService.getTaskIdFromSubResource('checklist_item', itemId);
  await authService.assertTaskAccess(taskId, userId, 'edit');
  const { data, error } = await supabase
    .from('task_checklist_items')
    .update({
      is_done: isDone,
      completed_at: isDone ? new Date().toISOString() : null,
      completed_by: isDone ? userId : null
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Chấm công / Ghi nhận thời gian làm việc (Time Log)
 */
async function logTime(taskId, timeData, userId) {
  await authService.assertTaskAccess(taskId, userId, 'edit');
  const { startedAt, endedAt = null, note = '', isBillable = false } = timeData;

  const { data, error } = await supabase
    .from('time_logs')
    .insert([{
      task_id: taskId,
      user_id: userId,
      started_at: startedAt || new Date().toISOString(),
      ended_at: endedAt,
      note,
      is_billable: isBillable
    }])
    .select(`
      *,
      user:user_profiles!user_id(id, name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}


/**
 * Cập nhật board_column_order (và status_id) hàng loạt khi kéo thả Kanban
 */
async function bulkMoveTasks(moves, userId) {
  if (!Array.isArray(moves) || moves.length === 0) {
    throw new Error('Dữ liệu không hợp lệ');
  }
  const taskIds = moves.map(m => m.taskId);
  await authService.assertTasksAccess(taskIds, userId, 'edit');

  const updates = moves.map(move => {
    const payload = {
      board_column_order: move.boardColumnOrder
    };
    if (move.statusId) {
      payload.status_id = move.statusId;
    }
    
    return supabase
      .from('tasks')
      .update(payload)
      .eq('id', move.taskId)
      .eq('is_deleted', false);
  });

  const results = await Promise.all(updates);
  
  const errorResult = results.find(r => r.error);
  if (errorResult) {
    throw errorResult.error;
  }
  
  return { success: true, count: moves.length };
}


async function getSubtasks(taskId, userId) {
  await authService.assertTaskAccess(taskId, userId, 'view');
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id, title, status_id, priority, task_type,
      assignee_id, assignee:user_profiles!assignee_id(id, name, avatar_url),
      start_date, due_date, sort_order, is_archived
    `)
    .eq('parent_task_id', taskId)
    .eq('is_deleted', false)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function createSubtask(parentTaskId, subtaskData, userId) {
  await authService.assertTaskAccess(parentTaskId, userId, 'edit');
  const payload = { ...subtaskData, parentTaskId };
  return createTask(payload, userId);
}


async function getTaskActivities(taskId, userId) {
  await authService.assertTaskAccess(taskId, userId, 'view');
  const { data, error } = await supabase
    .from('task_activities')
    .select(`
      id,
      activity_type,
      old_value,
      new_value,
      created_at,
      user:user_profiles!user_id(id, name, avatar_url)
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}


async function addAttachment(taskId, fileData, userId) {
  await authService.assertTaskAccess(taskId, userId, 'edit');
  const { file_name, storage_key, file_size, mime_type, thumbnail_key, fileName, storageKey, fileSize, mimeType, thumbnailKey } = fileData;
  const { data, error } = await supabase
    .from('task_attachments')
    .insert([{
      task_id: taskId,
      uploaded_by: userId,
      file_name: file_name || fileName,
      storage_key: storage_key || storageKey,
      file_size: file_size || fileSize,
      mime_type: mime_type || mimeType,
      thumbnail_key: thumbnail_key || thumbnailKey
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  addAttachment,
  getTaskActivities,
  getSubtasks,
  createSubtask,
  bulkMoveTasks,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  bulkDeleteTasks,
  bulkUpdateTasks,
  addComment,
  createChecklist,
  toggleChecklistItem,
  logTime
};




