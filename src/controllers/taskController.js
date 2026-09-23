const taskService = require('../services/taskService');

exports.getTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await taskService.getTasks(req.query, userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:getTasks] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi lấy danh sách tác vụ', details: error.message });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: taskId } = req.params;
    const task = await taskService.getTaskById(taskId, userId);
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy tác vụ hoặc đã bị xóa' });
    }
    return res.status(200).json(task);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:getTaskById] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi lấy chi tiết tác vụ', details: error.message });
  }
};

exports.createTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Tiêu đề tác vụ không được để trống' });
    }
    const task = await taskService.createTask(req.body, userId);
    return res.status(201).json(task);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:createTask] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi tạo tác vụ', details: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: taskId } = req.params;
    const task = await taskService.updateTask(taskId, req.body, userId);
    return res.status(200).json(task);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:updateTask] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi cập nhật tác vụ', details: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: taskId } = req.params;
    const result = await taskService.deleteTask(taskId, userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:deleteTask] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi xóa tác vụ', details: error.message });
  }
};

exports.bulkDeleteTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskIds } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'taskIds phai la mang khong rong' });
    }
    const result = await taskService.bulkDeleteTasks(taskIds, userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:bulkDeleteTasks] Error:', error);
    return res.status(500).json({ error: 'Loi server khi xoa hang loat', details: error.message });
  }
};

exports.bulkUpdateTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskIds } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'taskIds phai la mang khong rong' });
    }
    const result = await taskService.bulkUpdateTasks(taskIds, req.body, userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:bulkUpdateTasks] Error:', error);
    return res.status(500).json({ error: 'Loi server khi cap nhat hang loat', details: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: taskId } = req.params;
    const comment = await taskService.addComment(taskId, req.body, userId);
    return res.status(201).json(comment);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:addComment] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi thêm bình luận', details: error.message });
  }
};

exports.createChecklist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: taskId } = req.params;
    const task = await taskService.createChecklist(taskId, req.body, userId);
    return res.status(201).json(task);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:createChecklist] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi tạo checklist', details: error.message });
  }
};

exports.toggleChecklistItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { isDone } = req.body;
    const item = await taskService.toggleChecklistItem(itemId, isDone, userId);
    return res.status(200).json(item);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:toggleChecklistItem] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi cập nhật checklist item', details: error.message });
  }
};

exports.logTime = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: taskId } = req.params;
    const log = await taskService.logTime(taskId, req.body, userId);
    return res.status(201).json(log);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:logTime] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi ghi nhận thời gian', details: error.message });
  }
};

exports.bulkMoveTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { moves } = req.body;
    const result = await taskService.bulkMoveTasks(moves, userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[TaskController:bulkMoveTasks] Error:', error);
    return res.status(500).json({ error: 'Lỗi server khi cập nhật hàng loạt', details: error.message });
  }
};

exports.getSubtasks = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const subtasks = await taskService.getSubtasks(id, userId);
    return res.status(200).json(subtasks);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }

    return res.status(500).json({ error: 'Lỗi server khi lấy subtasks', details: error.message });
  }
};

exports.createSubtask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const subtask = await taskService.createSubtask(id, req.body, userId);
    return res.status(201).json(subtask);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }

    return res.status(500).json({ error: 'Lỗi server khi tạo subtask', details: error.message });
  }
};

exports.getTaskActivities = async (req, res) => {
  try {
    const { id } = req.params;
    const activities = await taskService.getTaskActivities(id);
    return res.status(200).json(activities);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }

    return res.status(500).json({ error: 'Lỗi server khi lấy lịch sử hoạt động', details: error.message });
  }
};

exports.addAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const attachment = await taskService.addAttachment(id, req.body, userId);
    return res.status(201).json(attachment);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }

    return res.status(500).json({ error: 'Lỗi server khi thêm file đính kèm', details: error.message });
  }
};
