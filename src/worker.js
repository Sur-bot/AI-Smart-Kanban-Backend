const { Worker } = require('bullmq');
const sharp = require('sharp');
const redisConnection = require('./config/redis');
const supabase = require('./config/supabase');
const storageService = require('./services/storageService');

const BUCKET_NAME = 'ai-kanban-storage';

const worker = new Worker('image-processing', async (job) => {
  const { fileId, storageKey, userId } = job.data;
  console.log(`[Worker] Bắt đầu tối ưu ảnh: ${fileId} (${storageKey})`);

  try {
    // 1. Tải ảnh gốc từ Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storageKey);

    if (downloadError) throw new Error(`Tải ảnh thất bại: ${downloadError.message}`);

    const buffer = await fileData.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    // 2. Phân tích kích thước & nén WebP (Max 1920px, Quality 80%)
    const originalMetadata = await sharp(imageBuffer).metadata();
    
    // Tự động thu nhỏ nếu vượt quá 1920px chiều rộng hoặc chiều cao
    const sharpInstance = sharp(imageBuffer)
      .resize({
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80, effort: 4 })
      .withMetadata(false);

    const optimizedBuffer = await sharpInstance.toBuffer();
    const optimizedMetadata = await sharp(optimizedBuffer).metadata();

    // 3. Tạo Thumbnail chất lượng cao (300x300)
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .withMetadata(false)
      .toBuffer();

    // 4. Định dạng đường dẫn WebP mới
    const newStorageKey = storageKey.replace(/\.[^/.]+$/, "") + '.webp';
    const thumbnailKey = storageKey.replace(/\.[^/.]+$/, "") + '_thumb.webp';

    // 5. Upload 2 file WebP lên Supabase Storage
    const { error: uploadOptError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(newStorageKey, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });
    if (uploadOptError) throw uploadOptError;

    const { error: uploadThumbError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(thumbnailKey, thumbnailBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });
    if (uploadThumbError) throw uploadThumbError;

    // 6. Cập nhật metadata hoàn chỉnh vào DB
    const { error: dbError } = await supabase
      .from('storage_files')
      .update({
        storage_key: newStorageKey,
        thumbnail_key: thumbnailKey,
        extension: 'webp',
        mime_type: 'image/webp',
        size_bytes: optimizedBuffer.length,
        width: optimizedMetadata.width || originalMetadata.width || 0,
        height: optimizedMetadata.height || originalMetadata.height || 0,
        status: 'READY',
        updated_at: new Date().toISOString()
      })
      .eq('id', fileId);

    if (dbError) throw dbError;

    // 7. Dọn dẹp ảnh gốc nếu định dạng cũ không phải .webp trùng tên
    if (storageKey !== newStorageKey) {
      await supabase.storage.from(BUCKET_NAME).remove([storageKey]);
    }

    // 8. Đồng bộ lại Quota thực tế cho tài khoản sau khi nén tiết kiệm dung lượng
    if (userId) {
      await storageService.recalculateUserQuota(userId);
    } else {
      // Thử lấy userId từ storage_files nếu chưa truyền trong job
      const { data: sf } = await supabase.from('storage_files').select('user_id').eq('id', fileId).single();
      if (sf?.user_id) {
        await storageService.recalculateUserQuota(sf.user_id);
      }
    }

    console.log(`[Worker] Tối ưu thành công: ${fileId} (Kích thước: ${optimizedBuffer.length} bytes, Giảm: ${Math.round((1 - optimizedBuffer.length / imageBuffer.length) * 100)}%)`);
    return { success: true, newSize: optimizedBuffer.length };

  } catch (error) {
    console.error(`[Worker Error] ${fileId}:`, error.message);
    throw error;
  }
}, { connection: redisConnection });

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} thất bại: ${err.message}`);
});

console.log('[Worker] Storage Optimizer sẵn sàng tiếp nhận công việc');

module.exports = worker;