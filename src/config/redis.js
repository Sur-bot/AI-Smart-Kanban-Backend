const Redis = require('ioredis');

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  console.error('❌ [Redis] Lỗi kết nối Redis:', err);
});

connection.on('ready', () => {
  console.log('✅ [Redis] Đã kết nối thành công!');
});

module.exports = connection;
