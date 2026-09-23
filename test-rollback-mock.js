const assert = require('assert');

// Mock state
let projectTable = { owner_id: 'user-A' };
let memberTable = { 
  'user-A': { role: 'owner' }, 
  'user-B': { role: 'member' } 
};

// Mock Auth Error
class AuthError extends Error {
  constructor(msg, code) { super(msg); this.statusCode = code; }
}

async function transferOwnership(projectId, newOwnerUserId, currentUserId) {
  // 1. Auth (Skipped in mock for simplicity)
  
  // 2. Backup current owner
  const backupOwnerId = projectTable.owner_id;

  try {
    // 3. Update projects table
    projectTable.owner_id = newOwnerUserId;

    // 4. Update project_members for old owner (Mock throw error)
    // Simulate DB failure here
    throw new Error('Database connection lost during member update');
    
    // memberTable[currentUserId].role = 'admin';
    // memberTable[newOwnerUserId] = { role: 'owner' };
    
  } catch (error) {
    // 5. ROLLBACK
    projectTable.owner_id = backupOwnerId; // Khoi phuc owner_id ve gia tri cu
    console.error('[Rollback] Đã khôi phục owner_id do lỗi cấp quyền members:', error.message);
    throw new AuthError('Lỗi trong quá trình chuyển nhượng, đã hoàn tác.', 500);
  }
}

async function runTests() {
  console.log('--- BAT DAU CHAY TEST ROLLBACK TRANSFER OWNERSHIP ---');
  try {
    await transferOwnership('proj-1', 'user-B', 'user-A');
  } catch (e) {
    console.log('✅ PASS: Ham nem loi an toan ->', e.message);
  }
  
  if (projectTable.owner_id === 'user-A') {
    console.log('✅ PASS: owner_id tren bang projects da duoc rollback ve an toan (user-A).');
  } else {
    console.error('❌ FAIL: owner_id bi loi lech pha thanh', projectTable.owner_id);
  }
  console.log('--- KET THUC ---');
}
runTests();
