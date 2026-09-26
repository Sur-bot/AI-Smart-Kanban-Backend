const assert = require('assert');
const taskService = require('./src/services/taskService');
const projectService = require('./src/services/projectService');
const supabase = require('./src/config/supabase');

const mockUserA = 'user-A';
const mockUserB = 'user-B';
const mockWorkspaceW = 'workspace-W';
const mockProjectX = 'project-X';
const mockProjectY = 'project-Y';

// Mock projectService
projectService.getOrCreateDefaultWorkspace = async () => ({ id: mockWorkspaceW });

// Mock supabase
supabase.from = (table) => {
  return {
    select: (fields, options) => {
      let currentWorkspace = null;
      let allowedProjects = null;
      
      const queryObj = {
        eq: function(c1, v1) {
          if (table === 'projects' && c1 === 'owner_id') {
             if (v1 === mockUserA) return { data: [{ id: mockProjectX }], error: null };
             return { data: [], error: null };
          }
          if (table === 'project_members' && c1 === 'user_id') {
             if (v1 === mockUserB) return { data: [{ project_id: mockProjectY }], error: null };
             return { data: [], error: null };
          }
          if (c1 === 'is_deleted') return this;
          if (c1 === 'is_archived') return this;
          if (c1 === 'workspace_id') { currentWorkspace = v1; return this; }
          return this;
        },
        in: function(c2, arr) {
          if (c2 === 'project_id') { allowedProjects = arr; return this; }
          return this;
        },
        order: function() { return this; },
        range: async function() {
          const dbTasks = [
            { id: 'task-1-X', project_id: mockProjectX, workspace_id: mockWorkspaceW },
            { id: 'task-2-Y', project_id: mockProjectY, workspace_id: mockWorkspaceW }
          ];
          
          let result = dbTasks;
          if (currentWorkspace) result = result.filter(t => t.workspace_id === currentWorkspace);
          if (allowedProjects) result = result.filter(t => allowedProjects.includes(t.project_id));
          
          return { data: result, error: null, count: result.length };
        }
      };
      return queryObj;
    }
  };
};

async function runDataLeakTest() {
  console.log('--- BAT DAU CHAY TEST DATA LEAK GETTASKS ---');
  
  const resultA = await taskService.getTasks({ workspaceId: mockWorkspaceW }, mockUserA);
  const idsA = resultA.tasks.map(t => t.id);
  
  if (idsA.includes('task-1-X') && !idsA.includes('task-2-Y')) {
    console.log('✅ PASS: User A CHỈ nhận được task của Project X, không bị lọt task Project Y.');
  } else {
    console.error('❌ FAIL: Kết quả của User A sai lệch:', idsA);
  }

  const resultB = await taskService.getTasks({ workspaceId: mockWorkspaceW }, mockUserB);
  const idsB = resultB.tasks.map(t => t.id);

  if (!idsB.includes('task-1-X') && idsB.includes('task-2-Y')) {
    console.log('✅ PASS: User B CHỈ nhận được task của Project Y, không bị lọt task Project X.');
  } else {
    console.error('❌ FAIL: Kết quả của User B sai lệch:', idsB);
  }
  
  console.log('--- KET THUC ---');
}
runDataLeakTest();
