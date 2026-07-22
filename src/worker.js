const { Worker } = require('bullmq');
const sharp = require('sharp');
const redisConnection = require('./config/redis');
const supabase = require('./config/supabase');

const BUCKET_NAME = 'ai-kanban-storage';

const worker = new Worker('image-processing', async (job) => {
  const { fileId, storageKey } = job.data;
  console.log(`[Worker] Processing: ${fileId}`);

  try {
    // 1. Tải ảnh gốc từ Supabase
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storageKey);

    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

    const buffer = await fileData.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    // 2. Nén WebP (80%) & Xóa Metadata
    const optimizedBuffer = await sharp(imageBuffer)
      .webp({ quality: 80 })
      .withMetadata(false)
      .toBuffer();

    // 3. Tạo Thumbnail (500x500)
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(500, 500, { fit: 'cover' })
      .webp({ quality: 80 })
      .withMetadata(false)
      .toBuffer();

    // 4. Đường dẫn mới
    const newStorageKey = storageKey.replace(/\.[^/.]+$/, "") + '.webp';
    const thumbnailKey = storageKey.replace(/\.[^/.]+$/, "") + '_thumb.webp';

    // 5. Upload lên Supabase Storage
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

    // 6. Cập nhật DB
    const { error: dbError } = await supabase
      .from('storage_files')
      .update({
        storage_key: newStorageKey,
        thumbnail_key: thumbnailKey,
        extension: 'webp',
        size_bytes: optimizedBuffer.length,
      })
      .eq('id', fileId);

    if (dbError) throw dbError;

    // 7. Dọn dẹp ảnh gốc nếu khác đuôi file
    if (storageKey !== newStorageKey) {
      await supabase.storage.from(BUCKET_NAME).remove([storageKey]);
    }

    console.log(`[Worker] Done: ${fileId}`);
    return { success: true };

  } catch (error) {
    console.error(`[Worker Error] ${fileId}:`, error.message);
    throw error;
  }
}, { connection: redisConnection });

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed: ${err.message}`);
});

console.log('[Worker] Ready');

module.exports = worker;
