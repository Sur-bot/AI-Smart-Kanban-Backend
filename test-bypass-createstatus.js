const assert = require('assert');
const projectService = require('./src/services/projectService');
const authService = require('./src/services/authService');
const supabase = require('./src/config/supabase');

const projectId = 'proj-1';
const hackerId = 'user-hacker';

supabase.from = (table) => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: async () => ({ data: null, error: { message: 'Not found' } }), // project not found OR not a member
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    order: () => chain
  };
  return chain;
};

async function testCreateStatus() {
  console.log('--- BAT DAU CHAY TEST BYPASS CREATE PROJECT STATUS ---');
  try {
    await projectService.createProjectStatus(projectId, { name: 'Hack Status' }, hackerId);
    console.error('❌ FAIL: Hacker tao status thanh cong!');
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 403 || e.message.includes('Project khong ton tai') || e.message.includes('Forbidden')) {
      console.log('✅ PASS: Ham createProjectStatus bi chan dung chuan AuthError ->', e.message);
    } else {
      console.error('❌ FAIL: Loi khong mong doi:', e.message);
    }
  }
  console.log('--- KET THUC ---');
}
testCreateStatus();
