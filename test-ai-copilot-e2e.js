const request = require('supertest');
const express = require('express');
const app = express();
app.use(express.json());

// Mock Auth Middleware
app.use((req, res, next) => {
  req.user = { id: 'user-123' };
  next();
});

// Mock Dependencies
const aiService = require('./src/services/aiService');
const aiQuotaService = require('./src/services/aiQuotaService');
aiService.executeAction = async (userId, actionId, sessionId) => {
  if (actionId === 'valid-action') return { success: true, message: 'Da tao', data: { id: 'task-1' } };
  throw new Error('Action not found or expired');
};
aiQuotaService.getQuota = async () => ({ current: 1, max: 10 });

// Map Routes
const aiRoutes = require('./src/routes/aiRoutes');
app.use('/api/ai', aiRoutes);

async function runE2E() {
  console.log('--- BAT DAU CHAY TEST E2E AI COPILOT VIA HTTP ---');
  
  // Test 1: Valid request
  const res1 = await request(app)
    .post('/api/ai/actions/confirm')
    .send({ actionId: 'valid-action', sessionId: 'session-123' });
    
  if (res1.status === 200 && res1.body.success) {
    console.log('✅ PASS: [E2E HTTP] API trả về 200 OK khi gọi action hợp lệ');
  } else {
    console.error('❌ FAIL: [E2E HTTP] API lỗi:', res1.body);
  }

  // Test 2: Missing actionId
  const res2 = await request(app)
    .post('/api/ai/actions/confirm')
    .send({ sessionId: 'session-123' });
    
  if (res2.status === 400) {
    console.log('✅ PASS: [E2E HTTP] API trả về 400 BadRequest khi thiếu actionId');
  } else {
    console.error('❌ FAIL: [E2E HTTP] Khong tra ve 400', res2.body);
  }

  // Test 3: Invalid actionId
  const res3 = await request(app)
    .post('/api/ai/actions/confirm')
    .send({ actionId: 'invalid-action', sessionId: 'session-123' });
    
  if (res3.status === 404) {
    console.log('✅ PASS: [E2E HTTP] API trả về 404 NotFound khi actionId sai/hết hạn');
  } else {
    console.error('❌ FAIL: [E2E HTTP] Khong tra ve 404', res3.body);
  }
  
  console.log('--- KET THUC ---');
}
runE2E();
