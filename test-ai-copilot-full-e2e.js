const assert = require('assert');
const aiController = require('./src/controllers/aiController');
const aiQuotaService = require('./src/services/aiQuotaService');
const projectService = require('./src/services/projectService');
const supabase = require('./src/config/supabase');

const mockUserA = 'user-A';
const mockUserB = 'user-B';
const mockProjectA = 'project-A';
const mockProjectB = 'project-B';
const mockSessionId = 'session-123';
const mockActionIdSuccess = 'action-success';
const mockActionIdFail = 'action-fail';

// Mock Quota
aiQuotaService.checkQuota = async () => true;
aiQuotaService.getQuota = async () => ({ current: 1, max: 10 });
aiQuotaService.incrementUsage = async () => {};

// Mock projectService
projectService.isProjectMember = async (projectId, userId) => {
  if (projectId === mockProjectA && userId === mockUserA) return true;
  return false; // user-A is NOT member of project-B
};
projectService.getOrCreateDefaultWorkspace = async () => ({ id: 'ws1' });
projectService.getOrCreateDefaultProject = async () => ({ id: mockProjectA });
projectService.getProjectStatuses = async () => [{ id: 'status1', is_default: true }];

// Mock supabase
let dbMutated = false;
supabase.from = (table) => ({
  select: (fields) => ({
    eq: (col, val) => ({
      eq: () => ({
        order: () => ({
          limit: async () => {
            if (table === 'ai_chat_messages') {
              return { data: [{ 
                metadata: { 
                  pendingActions: [
                    { id: mockActionIdSuccess, functionName: 'createTask', parameters: { title: 'Test E2E Success', projectId: mockProjectA } },
                    { id: mockActionIdFail, functionName: 'createTask', parameters: { title: 'Test E2E Fail', projectId: mockProjectB } }
                  ] 
                } 
              }], error: null };
            }
            return { data: [], error: null };
          }
        }),
        single: async () => {
          if (table === 'tasks') {
             // Mock assertTaskAccess returning task info if needed
             return { data: { id: val, creator_id: mockUserB, project_id: mockProjectB, is_deleted: false }, error: null };
          }
          return { data: null, error: 'Not found' };
        }
      }),
      single: async () => {
        // Mock getSession checking
        if (table === 'ai_chat_sessions') return { data: { id: val }, error: null };
        return { data: null, error: null };
      }
    })
  }),
  insert: () => ({
    select: () => ({
      single: async () => {
        if (table === 'tasks') {
          dbMutated = true;
          return { data: { id: 'new-task', title: 'Test E2E', creator_id: mockUserA }, error: null };
        }
        if (table === 'ai_chat_messages') {
          return { data: {}, error: null };
        }
        return { data: null, error: null };
      }
    })
  })
});

async function runE2E() {
  console.log('--- BAT DAU CHAY TEST E2E AI COPILOT VIA CONTROLLER ---');
  
  // Test 1: User A creates task in Project A (Success)
  dbMutated = false;
  let req1 = { user: { id: mockUserA }, body: { actionId: mockActionIdSuccess, sessionId: mockSessionId } };
  let res1 = {
    statusCode: null, jsonData: null,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.jsonData = data; return this; }
  };
  await aiController.confirmAction(req1, res1);
  if (res1.statusCode === 200 && res1.jsonData.success === true && dbMutated) {
    console.log('✅ PASS: [E2E] Controller -> aiService -> taskService -> DB (Tạo task THÀNH CÔNG hợp lệ)');
  } else {
    console.error('❌ FAIL: [E2E] Loi tao task hop le:', res1.statusCode, res1.jsonData);
  }

  // Test 2: User A tries to create task in Project B (Fail 403)
  dbMutated = false;
  let req2 = { user: { id: mockUserA }, body: { actionId: mockActionIdFail, sessionId: mockSessionId } };
  let res2 = {
    statusCode: null, jsonData: null,
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.jsonData = data; return this; }
  };
  await aiController.confirmAction(req2, res2);
  
  // The controller catches errors. If taskService throws AuthError(403), controller will catch it and return 500 AIError for security.
  // Wait, let's see how aiController handles errors:
  // "return res.status(500).json({ error: 'AIError', message: 'Khong the thuc thi hanh dong. Vui long thu lai.' });"
  // It translates 403 to 500 in the response, but doesn't allow DB mutation!
  if (res2.statusCode === 403 && dbMutated === false) {
    console.log('✅ PASS: [E2E] Controller chặn tạo task trái phép (Bị authService ném lỗi, không ghi DB)');
  } else {
    console.error('❌ FAIL: [E2E] Khong chan hoac loi sai:', res2.statusCode, res2.jsonData);
  }
  
  console.log('--- KET THUC ---');
}
runE2E();
