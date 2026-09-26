const assert = require('assert');
const mockUserA = 'userA';
const mockUserB = 'userB';
const mockProjectB = 'projectB';
const mockTaskB = 'taskB';
const mockChecklistB = 'checklistB';
const mockItemB = 'itemB';

let db = {
  tasks: {
    [mockTaskB]: { id: mockTaskB, creator_id: mockUserB, project_id: mockProjectB, is_deleted: false }
  },
  task_checklists: {
    [mockChecklistB]: { id: mockChecklistB, task_id: mockTaskB }
  },
  task_checklist_items: {
    [mockItemB]: { id: mockItemB, checklist_id: mockChecklistB }
  }
};

const authService = require('./src/services/authService');
const projectService = require('./src/services/projectService');
const taskService = require('./src/services/taskService');
const supabase = require('./src/config/supabase');

// Mock projectService
projectService.isProjectMember = async (projectId, userId) => {
  if (projectId === mockProjectB && userId === mockUserB) return true;
  return false;
};
projectService.getOrCreateDefaultWorkspace = async () => ({ id: 'ws1' });
projectService.getOrCreateDefaultProject = async () => ({ id: mockProjectB });
projectService.getProjectStatuses = async () => [{ id: 'status1', is_default: true }];

// Mock supabase
let dbMutated = false;
supabase.from = (table) => ({
  select: (fields) => {
    const chain = {
      _eqs: {},
      eq: (col, val) => {
        chain._eqs[col] = val;
        return chain;
      },
      in: (col, arr) => {
        if (table === 'tasks') return { data: arr.map(id => db.tasks[id]).filter(Boolean), error: null };
        return { data: [], error: null };
      },
      single: async () => {
        if (table === 'projects') return { data: { owner_id: mockUserB }, error: null };
        if (table === 'project_members') return { data: null, error: { message: 'Not member' } };
        if (table === 'tasks') return { data: db.tasks[chain._eqs['id'] || 'taskB'], error: null };
        if (table === 'task_checklist_items') return { data: db.task_checklist_items[chain._eqs['id'] || 'itemB'], error: null };
        if (table === 'task_checklists') return { data: db.task_checklists[chain._eqs['id'] || 'checklistB'], error: null };
        return { data: null, error: 'Not found' };
      }
    };
    return chain;
  },
  update: () => ({
    eq: async () => { dbMutated = true; return { error: null }; },
    in: async () => { dbMutated = true; return { error: null }; }
  }),
  insert: () => ({
    select: () => ({
      single: async () => { dbMutated = true; return { data: { id: 'new' }, error: null }; }
    })
  }),
  delete: () => ({ eq: async () => {} })
});

async function runTest(name, fn) {
  dbMutated = false;
  try {
    await fn();
    console.error('❌ FAIL: ' + name + ' (Khong nem ra loi 403)');
  } catch (e) {
    if (e.statusCode === 403 && !dbMutated) {
      console.log('✅ PASS: ' + name);
    } else {
      console.error('❌ FAIL: ' + name + ' (Loi sai hoac DB bi thay doi: ' + e.message + ')');
    }
  }
}

async function main() {
  console.log('--- BAT DAU CHAY TEST AUTH BYPASS ---');
  
  await runTest('bulkDeleteTasks chặn User A xóa task của User B', async () => {
    await taskService.bulkDeleteTasks([mockTaskB], mockUserA);
  });

  await runTest('bulkUpdateTasks chặn User A sửa task của User B', async () => {
    await taskService.bulkUpdateTasks([mockTaskB], { priority: 'high' }, mockUserA);
  });

  await runTest('bulkMoveTasks chặn User A di chuyển task của User B', async () => {
    await taskService.bulkMoveTasks([{ taskId: mockTaskB, boardColumnOrder: 1 }], mockUserA);
  });

  await runTest('toggleChecklistItem chặn User A check mục của User B', async () => {
    await taskService.toggleChecklistItem(mockItemB, true, mockUserA);
  });

  await runTest('addComment chặn User A comment vào task của User B', async () => {
    await taskService.addComment(mockTaskB, { content: 'test' }, mockUserA);
  });

  await runTest('logTime chặn User A log time vào task của User B', async () => {
    await taskService.logTime(mockTaskB, { startedAt: new Date() }, mockUserA);
  });

  await runTest('createTask chặn User A tạo task trong project của User B', async () => {
    await taskService.createTask({ projectId: mockProjectB, title: 'Spam' }, mockUserA);
  });

  console.log('--- KET THUC ---');
}
main();
