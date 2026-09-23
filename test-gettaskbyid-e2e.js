const assert = require('assert');
const taskController = require('./src/controllers/taskController');
const taskService = require('./src/services/taskService');
const authService = require('./src/services/authService');

const mockUserA = 'user-A'; // Hacker / Owner
const mockUserB = 'user-B'; // Victim
const mockTaskId = 'task-B';
const mockMyTaskId = 'task-A';

// Mock authService to throw AuthError (403) as it normally does for unauthorized access
authService.assertTaskAccess = async (taskId, userId) => {
  if (taskId === mockTaskId && userId !== mockUserB) {
    throw new authService.AuthError('Forbidden: Ban khong co quyen truy cap task nay', 403);
  }
  // Otherwise, success (e.g. mockMyTaskId and mockUserA)
};

// Mock taskService.getTaskById to return fake data if successful
taskService.getTaskById = async (taskId, userId) => {
  await authService.assertTaskAccess(taskId, userId);
  return { id: taskId, title: 'Mock Task', creator_id: userId };
};

async function runE2E() {
  console.log('--- BAT DAU CHAY TEST E2E HTTP GETTASKBYID ---');
  
  // Test 1: User A truy cap task cua User B
  let req1 = {
    user: { id: mockUserA },
    params: { id: mockTaskId }
  };
  
  let res1 = {
    statusCode: null, jsonData: null,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.jsonData = data; return this; }
  };
  await taskController.getTaskById(req1, res1);
  if (res1.statusCode === 403) {
    console.log('✅ PASS: [E2E] Controller getTaskById nhan dien dung loi va tra ve HTTP 403 Forbidden!');
  } else {
    console.error('❌ FAIL: [E2E] Controller getTaskById tra ve sai ma loi:', res1.statusCode, res1.jsonData);
  }

  // Test 2: User A truy cap task cua User A (Hop le)
  let req2 = {
    user: { id: mockUserA },
    params: { id: mockMyTaskId }
  };
  let res2 = {
    statusCode: null, jsonData: null,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.jsonData = data; return this; }
  };
  await taskController.getTaskById(req2, res2);
  if (res2.statusCode === 200 && res2.jsonData.id === mockMyTaskId) {
    console.log('✅ PASS: [E2E] Controller getTaskById tra ve dung data (HTTP 200) cho truy cap hop le!');
  } else {
    console.error('❌ FAIL: [E2E] Hop le nhung that bai:', res2.statusCode, res2.jsonData);
  }
  
  console.log('--- KET THUC ---');
}
runE2E();
