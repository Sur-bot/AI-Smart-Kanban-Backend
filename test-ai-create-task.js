const assert = require('assert');
const taskService = require('./src/services/taskService');
const projectService = require('./src/services/projectService');
const authService = require('./src/services/authService');
const supabase = require('./src/config/supabase');

const userId = 'user-test';
const targetProjectId = 'proj-1';
const targetWorkspaceId = 'ws-1';

projectService.getOrCreateDefaultWorkspace = async () => ({ id: targetWorkspaceId });
projectService.getOrCreateDefaultProject = async () => ({ id: targetProjectId });

// MOCK authService.assertProjectRole
authService.assertProjectRole = async (projectId, uid, roles) => {
  if (projectId === targetProjectId && uid === userId) {
    return 'owner'; // pass
  }
  throw new Error('AuthError');
};

// MOCK authService.assertProjectMember
authService.assertProjectMember = async (projectId, uid) => {
  if (projectId === targetProjectId && uid === userId) {
    return true; // pass
  }
  throw new Error('AuthError');
};

// MOCK projectService.getProjectStatuses to ensure it works
let statusCalledWithUserId = null;
projectService.getProjectStatuses = async (projectId, uid) => {
  statusCalledWithUserId = uid;
  return [{ id: 'status-1', is_default: true }];
};

projectService.isProjectMember = async () => true;

supabase.from = (table) => ({
  insert: () => ({
    select: () => ({
      single: async () => ({ data: { id: 'task-1', title: 'Test AI Task' }, error: null })
    })
  })
});

async function runTests() {
  console.log('--- BAT DAU CHAY TEST AI TAO TASK ---');
  try {
    const task = await taskService.createTask({ title: 'Test AI Task' }, userId);
    if (statusCalledWithUserId === userId) {
      console.log('✅ PASS: taskService.createTask goi thanh cong projectService.getProjectStatuses kem userId!');
    } else {
      console.error('❌ FAIL: getProjectStatuses khong nhan duoc userId! Nhin thay:', statusCalledWithUserId);
    }
  } catch (e) {
    console.error('❌ FAIL: Loi khong mong doi:', e.message);
  }
  console.log('--- KET THUC ---');
}
runTests();
