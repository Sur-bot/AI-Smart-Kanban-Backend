const assert = require('assert');
const projectController = require('./src/controllers/projectController');
const projectService = require('./src/services/projectService');

async function runTests() {
  console.log('--- BAT DAU CHAY TEST XU LY LOI FK CONSTRAINT (23503) CHO ADDMEMBER ---');

  const originalAddMember = projectService.addMemberToProject;

  try {
    // -------------------------------------------------------------
    // Test case 1: DB ném lỗi FK constraint 23503 (user_id không tồn tại)
    // -------------------------------------------------------------
    projectService.addMemberToProject = async () => {
      const error = new Error('insert or update on table "project_members" violates foreign key constraint "project_members_user_id_fkey"');
      error.code = '23503';
      throw error;
    };

    let status1 = null;
    let json1 = null;
    const req1 = {
      params: { id: 'project-uuid-123' },
      body: { userId: 'non-existent-user-id', role: 'member' },
      user: { id: 'owner-id' }
    };
    const res1 = {
      status: (code) => {
        status1 = code;
        return res1;
      },
      json: (data) => {
        json1 = data;
        return res1;
      }
    };

    await projectController.addMember(req1, res1);

    assert.strictEqual(status1, 400, 'Phai tra ve status HTTP 400');
    assert.strictEqual(json1.error, 'UserNotFound', 'Phai tra ve ma loi UserNotFound');
    assert.strictEqual(json1.message, 'Người dùng này không tồn tại trong hệ thống', 'Message phai ro rang');
    console.log('✅ PASS: TC1 - Bat dung ma loi 23503 -> HTTP 400 {"error": "UserNotFound", "message": "Người dùng này không tồn tại trong hệ thống"}');

    // -------------------------------------------------------------
    // Test case 2: Loi server 500 khac (khong phai 23503)
    // -------------------------------------------------------------
    projectService.addMemberToProject = async () => {
      const error = new Error('Database connection lost');
      error.code = '08006';
      throw error;
    };

    let status2 = null;
    let json2 = null;
    const req2 = {
      params: { id: 'project-uuid-123' },
      body: { userId: 'valid-user-id', role: 'member' },
      user: { id: 'owner-id' }
    };
    const res2 = {
      status: (code) => {
        status2 = code;
        return res2;
      },
      json: (data) => {
        json2 = data;
        return res2;
      }
    };

    await projectController.addMember(req2, res2);

    assert.strictEqual(status2, 500, 'Loi he thong khac phai tra ve status HTTP 500');
    assert.strictEqual(json2.error, 'Loi server khi them thanh vien');
    console.log('✅ PASS: TC2 - Khong che giau ma loi he thong khac -> HTTP 500');

    // -------------------------------------------------------------
    // Test case 3: Thanh cong (Happy Path)
    // -------------------------------------------------------------
    const mockMember = { id: 'pm-1', user_id: 'user-valid', role: 'member' };
    projectService.addMemberToProject = async () => mockMember;

    let status3 = null;
    let json3 = null;
    const req3 = {
      params: { id: 'project-uuid-123' },
      body: { userId: 'user-valid', role: 'member' },
      user: { id: 'owner-id' }
    };
    const res3 = {
      status: (code) => {
        status3 = code;
        return res3;
      },
      json: (data) => {
        json3 = data;
        return res3;
      }
    };

    await projectController.addMember(req3, res3);

    assert.strictEqual(status3, 201, 'Thanh cong phai tra ve HTTP 201');
    assert.deepStrictEqual(json3, mockMember);
    console.log('✅ PASS: TC3 - Happy path them thanh vien thanh cong -> HTTP 201');

    console.log('--- TOAN BO TEST CHO LOI 23503 DA DAT CHUAN ---');
  } finally {
    projectService.addMemberToProject = originalAddMember;
  }
}

runTests().catch((err) => {
  console.error('❌ FAIL:', err);
  process.exit(1);
});
