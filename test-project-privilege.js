const assert = require('assert');
const projectService = require('./src/services/projectService');
const authService = require('./src/services/authService');
const supabase = require('./src/config/supabase');

const projectId = 'proj-1';
const ownerId = 'user-owner';
const admin1Id = 'user-admin1';
const admin2Id = 'user-admin2';
const targetUserId = 'user-target';

supabase.from = (table) => {
  const chain = {
    _eqs: {},
    select: () => chain,
    eq: (f, val) => {
      chain._eqs[f] = val;
      return chain;
    },
    single: async () => {
      if (table === 'projects') {
        return { data: { owner_id: ownerId }, error: null };
      }
      if (table === 'project_members') {
        const id = chain._eqs['id'];
        const uid = chain._eqs['user_id'];
        
        if (uid === ownerId) return { data: { role: 'owner', user_id: ownerId }, error: null };
        if (uid === admin1Id) return { data: { role: 'admin', user_id: admin1Id }, error: null };
        if (uid === admin2Id) return { data: { role: 'admin', user_id: admin2Id }, error: null };
        
        if (id === 'member-owner') return { data: { id: 'member-owner', role: 'owner', user_id: ownerId }, error: null };
        if (id === 'member-admin1') return { data: { id: 'member-admin1', role: 'admin', user_id: admin1Id }, error: null };
        if (id === 'member-admin2') return { data: { id: 'member-admin2', role: 'admin', user_id: admin2Id }, error: null };

        return { data: null, error: { message: 'Not found' } };
      }
      return { data: null, error: { message: 'Not found' } };
    },
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    upsert: () => chain,
    then: (resolve) => resolve({ data: { id: 1 }, error: null })
  };
  return chain;
};

async function runTests() {
  console.log('--- BAT DAU CHAY TEST LEO THANG DAC QUYEN VA XOA THANH VIEN ---');

  try {
    await projectService.addMemberToProject(projectId, { userId: targetUserId, role: 'owner' }, admin1Id);
    console.error('❌ FAIL: Admin1 gan quyen Owner thanh cong (LEO THANG)');
  } catch (e) {
    if (e.message.includes('Chi Owner moi duoc cap quyen Admin/Owner cho nguoi khac')) {
      console.log('✅ PASS: Admin khong the gan quyen Owner cho user khac.');
    } else {
      console.error('❌ FAIL: Loi khong mong doi:', e.message);
    }
  }

  try {
    await projectService.removeMember(projectId, 'member-owner', admin1Id);
    console.error('❌ FAIL: Admin1 xoa duoc Owner');
  } catch (e) {
    if (e.message.includes('Không thể xóa Owner')) {
      console.log('✅ PASS: Admin khong the xoa Owner khoi project.');
    } else {
      console.error('❌ FAIL: Loi khong mong doi:', e.message);
    }
  }

  try {
    await projectService.removeMember(projectId, 'member-admin2', admin1Id);
    console.error('❌ FAIL: Admin1 xoa duoc Admin2');
  } catch (e) {
    if (e.message.includes('Chỉ Owner mới được quyền xóa Admin khác')) {
      console.log('✅ PASS: Admin khong the xoa Admin khac khoi project.');
    } else {
      console.error('❌ FAIL: Loi khong mong doi:', e.message);
    }
  }

  try {
    await projectService.removeMember(projectId, 'member-admin1', ownerId);
    console.log('✅ PASS: Owner xoa Admin thanh cong.');
  } catch (e) {
    console.error('❌ FAIL: Owner xoa Admin that bai:', e.message);
  }

  console.log('--- KET THUC ---');
}
runTests();
