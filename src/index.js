require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Queue } = require('bullmq');
const redisConnection = require('./config/redis');

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');

const app = express();

// Configure CORS for credentials
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

const imageQueue = new Queue('image-processing', { connection: redisConnection });

app.post('/api/jobs/process-image', async (req, res) => {
  try {
    const { fileId, storageKey } = req.body;
    
    if (!fileId || !storageKey) {
      return res.status(400).json({ error: 'Thiếu fileId hoặc storageKey' });
    }

    await imageQueue.add('optimize-image', { fileId, storageKey }, {
      removeOnComplete: true,
      removeOnFail: false,
    });

    console.log(`[API] Job queued: ${fileId}`);
    return res.status(200).json({ message: 'Đã đưa vào hàng đợi xử lý', fileId });

  } catch (error) {
    console.error('[API Error]:', error.message);
    return res.status(500).json({ error: 'Lỗi server nội bộ' });
  }
});

app.delete('/api/jobs/image/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const supabase = require('./config/supabase');
    const BUCKET_NAME = 'ai-kanban-storage';

    // 1. Lấy thông tin ảnh từ DB
    const { data: fileData, error: fetchError } = await supabase
      .from('storage_files')
      .select('storage_key, thumbnail_key')
      .eq('id', fileId)
      .single();

    if (fetchError) {
      console.error('[API] Lỗi lấy thông tin file:', fetchError.message);
    }

    // 2. Soft delete trong DB
    const { error: dbError } = await supabase
      .from('storage_files')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', fileId);

    if (dbError) throw dbError;

    // 3. Xóa vật lý trên Storage (nếu có)
    if (fileData) {
      const keysToDelete = [fileData.storage_key];
      if (fileData.thumbnail_key) keysToDelete.push(fileData.thumbnail_key);
      
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(keysToDelete);
        
      if (storageError) console.warn('[API] Lỗi xóa vật lý từ Storage:', storageError.message);
    }

    console.log(`[API] Deleted: ${fileId}`);
    return res.status(200).json({ message: 'Đã xóa thành công' });

  } catch (error) {
    console.error('[API Delete Error]:', error.message);
    return res.status(500).json({ error: 'Lỗi server khi xóa ảnh' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Backend API running on port ${PORT}`);
  require('./worker');
});
