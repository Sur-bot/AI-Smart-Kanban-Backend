const assert = require('assert');
const aiService = require('./src/services/aiService');
const projectService = require('./src/services/projectService');
const supabase = require('./src/config/supabase');

const mockUserA = 'userA';
const mockUserB = 'userB';
const mockProjectA = 'projectA';
const mockProjectB = 'projectB';

// Mock projectService
projectService.isProjectMember = async (projectId, userId) => {
  if (projectId === mockProjectA && userId === mockUserA) return true;
  if (projectId === mockProjectB && userId === mockUserB) return true;
  return false;
};
projectService.getProjectStatuses = async () => [{ id: 'status1', is_default: true }];
projectService.getOrCreateDefaultWorkspace = async () => ({ id: 'ws1' });
projectService.getOrCreateDefaultProject = async (wsId, userId) => ({ id: userId === mockUserA ? mockProjectA : mockProjectB });

// Mock supabase
let insertedTasks = [];
supabase.from = (table) => ({
  insert: (data) => ({
    select: () => ({
      single: async () => {
        if (table === 'tasks') {
          insertedTasks.push(data[0]);
          return { data: { id: 'new-task', ...data[0] }, error: null };
        }
        return { data: null, error: null };
      }
    })
  })
});

async function runTest(name, fn) {
  insertedTasks = [];
  try {
    await fn();
  } catch (e) {
    console.error('❌ FAIL: ' + name + ' (Error: ' + e.message + ')');
  }
}

async function main() {
  console.log('--- BAT DAU CHAY TEST AI COPILOT ---');

  await runTest('AI CoPilot tạo task thành công (userId hợp lệ)', async () => {
    try {
      const result = await aiService.executeFunctionCall('createTask', {
        title: 'Task moi', projectId: mockProjectA
      }, mockUserA);
      
      if (result && result.title === 'Task moi' && result.creator_id === mockUserA) {
        console.log('✅ PASS: AI CoPilot tạo task thành công (userId hợp lệ)');
      } else {
        throw new Error('Result khong khop hoac khong thanh cong');
      }
    } catch(e) {
      throw e;
    }
  });

  await runTest('AI CoPilot bị chặn tạo task (không phải thành viên project)', async () => {
    try {
      await aiService.executeFunctionCall('createTask', {
        title: 'Hack Task', projectId: mockProjectB
      }, mockUserA);
      console.error('❌ FAIL: Khong bi chan 403');
    } catch (e) {
      if (e.statusCode === 403) {
        console.log('✅ PASS: AI CoPilot bị chặn tạo task (không phải thành viên project)');
      } else {
        throw e;
      }
    }
  });

  console.log('--- KET THUC ---');
}
main();
