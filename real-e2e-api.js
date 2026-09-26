const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = 'http://localhost:3000/api';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
console.log("E2E SUPABASE_URL: " + (SUPABASE_URL ? SUPABASE_URL.substring(0, 25) : "UNDEFINED") + "...");
async function runRealTest() {
  console.log('--- BAT DAU CHAY TEST THAT VOI DB VA API THUC TE ---');
  const rand = crypto.randomBytes(4).toString('hex');
  const emailA = 'usera-' + rand + '@test.com';
  const emailB = 'userb-' + rand + '@test.com';
  const password = 'Password123!';
  console.log('1. Tao User A va User B...');
  const { data: userAData, error: errA } = await supabase.auth.admin.createUser({
    email: emailA, password, email_confirm: true
  });
  if (errA) throw errA;
  const userA_id = userAData.user.id;
  const { data: userBData, error: errB } = await supabase.auth.admin.createUser({
    email: emailB, password, email_confirm: true
  });
  if (errB) throw errB;
  const userB_id = userBData.user.id;
  const { data: loginA } = await supabase.auth.signInWithPassword({ email: emailA, password });
  const tokenA = loginA.session.access_token;
  const { data: loginB } = await supabase.auth.signInWithPassword({ email: emailB, password });
  const tokenB = loginB.session.access_token;
  const axiosA = axios.create({ baseURL: API_URL, headers: { Authorization: 'Bearer ' + tokenA } });
  const axiosB = axios.create({ baseURL: API_URL, headers: { Authorization: 'Bearer ' + tokenB } });
  console.log('2. User A tao Project A...');
  const wsRes = await axiosA.get('/workspaces').catch(e => e.response);
  let workspaceId = null;
  if (wsRes && wsRes.status === 200 && wsRes.data.length > 0) {
    workspaceId = wsRes.data[0].id;
  } else {
    const newWs = await axiosA.post('/workspaces', { name: 'My Workspace' }).catch(e => e.response);
    workspaceId = newWs.data.id;
  }
  const resProj = await axiosA.post('/projects', {
    name: 'Project cua A',
    description: 'Test project',
    workspaceId: workspaceId
  }).catch(e => e.response);
  if (resProj.status !== 201 && resProj.status !== 200) throw new Error('Khong the tao project: ' + JSON.stringify(resProj.data));
  console.log('DEBUG: resProj status:', resProj.status, 'data:', resProj.data);
  const projectId = resProj.data.id || resProj.data.project?.id;
  console.log('DEBUG: projectId is', projectId);
  const {data: pCheck, error: pErr} = await supabase.from('projects').select('*').eq('id', projectId).single();
  console.log('DEBUG pCheck Error:', pErr);
  console.log('DEBUG: pCheck immediately after create:', pCheck?.id);
  console.log('3. User A tao Task A trong Project A...');
  const resStatuses = await axiosA.get('/projects/' + projectId + '/statuses');
  const statusId = resStatuses.data[0].id;
  const resTask = await axiosA.post('/tasks', {
    title: 'Task Cua A',
    projectId: projectId,
    statusId: statusId
  }).catch(e => e.response);
  const taskId = resTask.data.id || resTask.data.task?.id;
  console.log('4. User B (Hacker) co tinh xoa Task cua User A...');
  const resBTask = await axiosB.delete('/tasks/' + taskId).catch(e => e.response);
  if (resBTask.status === 403) {
    console.log('✅ PASS: User B nhan dung loi HTTP 403 khi xoa task: ' + resBTask.data.message);
  } else {
    console.log('❌ FAIL: User B nhan HTTP ' + resBTask.status + ' thay vi 403');
  }
  console.log('5. User B (Hacker) co tinh xem chi tiet Project cua User A...');
  const resBProj = await axiosB.get('/projects/' + projectId + '/members').catch(e => e.response);
  if (resBProj.status === 403) {
    console.log('✅ PASS: User B nhan dung loi HTTP 403 khi xem project: ' + resBProj.data.message);
  } else {
    console.log('❌ FAIL: User B nhan HTTP ' + resBProj.status + ' thay vi 403');
  }
  console.log('6. User A dung AI CoPilot tao task...');
  const resAI = await axiosA.post('/ai/chat', {
    message: 'Tao mot task ten la test task trong du an hien tai',
    projectId: projectId,
    conversationId: 'test-conv-1'
  }).catch(e => e.response);
  if (resAI.status === 200) {
    if (resAI.data.functionCall) {
       console.log(' AI de xuat functionCall, dang goi confirmAction...');
       const resConfirm = await axiosA.post('/ai/confirm-action', {
         functionCall: resAI.data.functionCall,
         projectId: projectId,
         conversationId: 'test-conv-1'
       }).catch(e => e.response);
       if (resConfirm.status === 200) {
         console.log('✅ PASS: AI CoPilot tao task THUC TE thanh cong (Khong bi crash undefined userId)');
       } else {
         console.log('❌ FAIL: AI ConfirmAction loi HTTP ' + resConfirm.status, resConfirm.data);
       }
    } else {
       console.log('✅ PASS: AI CoPilot xu ly thanh cong (khong crash)');
    }
  } else {
    console.log('❌ FAIL: AI CoPilot loi HTTP ' + resAI.status, resAI.data);
  }
    console.log('7. User A them User B vao Project voi vai tro admin/member...');
  const resAdd = await axiosA.post('/projects/' + projectId + '/members', {
    userId: userB_id,
    role: 'admin'
  }).catch(e => e.response);
  if (resAdd.status !== 200 && resAdd.status !== 201) {
    console.log('? FAIL: Khong the them User B vao Project qua API ' + resAdd.status, JSON.stringify(resAdd.data));
  } else {
    console.log('? PASS: Them User B vao Project thanh cong. Tien hanh transfer...');
    console.log('8. User A chuyen nhuong Project cho User B...');
    const resTransfer = await axiosA.post('/projects/' + projectId + '/transfer-ownership', {
      newOwnerUserId: userB_id
    }).catch(e => e.response);
    if (resTransfer.status === 200) {
       console.log('? PASS: transferOwnership hoat dong. Kiem tra DB...');
       const { data: dbProj, error: dbErr } = await supabase.from('projects').select('owner_id').eq('id', projectId).single();
       if (dbErr) console.log('DEBUG Error:', dbErr);
       if (dbProj && dbProj.owner_id === userB_id) {
         console.log('? PASS: owner_id trong DB da sang cho User B');
       } else {
         console.log('? FAIL: owner_id chua chuyen sang User B trong DB', dbProj);
       }
    } else {
       console.log('? FAIL: API transfer tra ve ' + resTransfer.status, JSON.stringify(resTransfer.data));
    }
  }
  console.log('--- KET THUC TEST THUC TE ---');
  await supabase.auth.admin.deleteUser(userA_id);
  await supabase.auth.admin.deleteUser(userB_id);
}
runRealTest().catch(console.error);







