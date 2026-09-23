const assert = require('assert');
const taskService = require('./src/services/taskService');
const projectService = require('./src/services/projectService');
const supabase = require('./src/config/supabase');

const mockUserA = 'user-A'; // Hacker
const mockUserB = 'user-B'; // Victim
const mockProjectB = 'project-B';
const mockTaskId = 'task-B';

// Mock projectService
projectService.isProjectMember = async (projectId, userId) => {
  return false; // User A is NOT in project B
};

// Mock supabase
supabase.from = (table) => ({
  select: () => {
    const chain = {
      _eqs: {},
      eq: (col, val) => {
        chain._eqs[col] = val;
        return chain;
      },
      single: async () => {
        if (table === 'projects') return { data: { owner_id: mockUserB }, error: null };
        if (table === 'project_members') return { data: null, error: { message: 'Not member' } };
        if (table === 'tasks') {
          return { data: { id: mockTaskId, creator_id: mockUserB, project_id: mockProjectB, is_deleted: false }, error: null };
        }
        return { data: null, error: 'Not found' };
      }
    };
    return chain;
  }
});

async function testAccess(name, fn) {
  try {
    await fn();
    console.error('❌ FAIL: ' + name + ' khong bi chan!');
  } catch (e) {
    if (e.statusCode === 403) {
      console.log('✅ PASS: ' + name + ' bi chan 403 Forbidden.');
    } else {
      console.error('❌ FAIL: Loi khong mong muon: ' + e.message);
    }
  }
}

async function runTests() {
  console.log('--- BAT DAU CHAY TEST 6 HAM CON LAI (AUTH BYPASS) ---');

  await testAccess('getTaskById (User A xem task B)', async () => {
    await taskService.getTaskById(mockTaskId, mockUserA);
  });

  await testAccess('getSubtasks (User A xem subtasks task B)', async () => {
    await taskService.getSubtasks(mockTaskId, mockUserA);
  });

  await testAccess('getTaskActivities (User A xem lich su task B)', async () => {
    await taskService.getTaskActivities(mockTaskId, mockUserA);
  });

  await testAccess('createSubtask (User A tao subtask cho task B)', async () => {
    await taskService.createSubtask(mockTaskId, { title: 'Hack' }, mockUserA);
  });

  await testAccess('createChecklist (User A tao checklist tren task B)', async () => {
    await taskService.createChecklist(mockTaskId, { title: 'Hack' }, mockUserA);
  });

  await testAccess('addAttachment (User A attach file vao task B)', async () => {
    await taskService.addAttachment(mockTaskId, { file_name: 'Hack' }, mockUserA);
  });

  console.log('--- KET THUC ---');
}
runTests();
