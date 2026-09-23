const assert = require('assert');

// Mock state
let projectTable = { owner_id: 'user-A' };
let memberTable = { 
  'user-A': { role: 'owner' }, 
  'user-B': { role: 'member' } 
};

class AuthError extends Error {
  constructor(msg, code) { super(msg); this.statusCode = code; }
}

async function transferOwnership(projectId, newOwnerUserId, currentUserId) {
  // 1. Backup state
  const backupOwnerId = projectTable.owner_id;
  const backupOldOwnerRole = memberTable[currentUserId]?.role || 'owner';

  // Biến cờ theo dõi tiến độ để rollback đúng mức
  let step = 0;

  try {
    // Buoc 1: Update bang projects
    projectTable.owner_id = newOwnerUserId;
    step = 1;

    // Buoc 2: Ha quyen owner cu thanh admin
    memberTable[currentUserId].role = 'admin';
    step = 2;

    // Buoc 3: Nang quyen owner moi (GIA LAP LOI TAI DAY)
    throw new Error('Database connection lost during new owner elevation');
    // memberTable[newOwnerUserId].role = 'owner';
    // step = 3;

  } catch (error) {
    console.error('[CRITICAL ALERT] Rollback triggered during transferOwnership. Error:', error.message);
    
    try {
      // ROLLBACK CHINH XAC THEO TIEN DO
      if (step >= 1) {
        projectTable.owner_id = backupOwnerId;
      }
      if (step >= 2) {
        memberTable[currentUserId].role = backupOldOwnerRole;
      }
    } catch (rollbackError) {
      console.error('[CRITICAL ALERT - FATAL] ROLLBACK FAILED! System is in an inconsistent state for project', projectId, 'Error:', rollbackError.message);
    }
    
    throw new AuthError('Loi trong qua trinh chuyen nhuong, he thong da hoan tac an toan.', 500);
  }
}

async function runTests() {
  console.log('--- BAT DAU CHAY TEST ROLLBACK DANG DO ---');
  try {
    await transferOwnership('proj-1', 'user-B', 'user-A');
  } catch (e) {
    console.log('✅ PASS: Ham nem loi an toan ->', e.message);
  }
  
  if (projectTable.owner_id === 'user-A') {
    console.log('✅ PASS: projects.owner_id duoc rollback (user-A).');
  } else {
    console.error('❌ FAIL: projects.owner_id sai:', projectTable.owner_id);
  }
  
  if (memberTable['user-A'].role === 'owner') {
    console.log('✅ PASS: project_members cua user-A duoc rollback thanh owner.');
  } else {
    console.error('❌ FAIL: project_members user-A sai:', memberTable['user-A'].role);
  }

  if (memberTable['user-B'].role === 'member') {
    console.log('✅ PASS: project_members cua user-B khong bi nang nham.');
  } else {
    console.error('❌ FAIL: project_members user-B sai:', memberTable['user-B'].role);
  }
  
  console.log('--- KET THUC ---');
}
runTests();
