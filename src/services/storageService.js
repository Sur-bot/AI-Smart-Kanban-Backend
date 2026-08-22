const supabase = require('../config/supabase');

const DEFAULT_QUOTA_BYTES = 524288000; // 500 MB (500 * 1024 * 1024)

/**
 * Lấy hoặc khởi tạo hạn mức dung lượng của người dùng
 */
async function getUserQuota(userId) {
  if (!userId) throw new Error('userId is required');

  // 1. Tìm thông tin quota trong bảng user_storage_quotas
  const { data: quotaData, error: quotaError } = await supabase
    .from('user_storage_quotas')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (quotaError && quotaError.code !== 'PGRST116') {
    console.error('[StorageService:getUserQuota] Lỗi query quota:', quotaError.message);
  }

  if (quotaData) {
    const usedBytes = parseInt(quotaData.used_bytes || 0, 10);
    const quotaBytes = parseInt(quotaData.quota_bytes || DEFAULT_QUOTA_BYTES, 10);
    const percentage = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
    
    return {
      userId,
      usedBytes,
      quotaBytes,
      fileCount: parseInt(quotaData.file_count || 0, 10),
      percentageUsed: percentage,
      availableBytes: Math.max(0, quotaBytes - usedBytes),
      isFull: usedBytes >= quotaBytes,
      updatedAt: quotaData.updated_at
    };
  }

  // 2. Nếu chưa có, tính toán từ các file hiện có và tạo mới bản ghi
  return await recalculateUserQuota(userId);
}

/**
 * Tính toán lại chính xác dung lượng đã sử dụng từ storage_files
 */
async function recalculateUserQuota(userId) {
  if (!userId) throw new Error('userId is required');

  // Lấy tổng dung lượng các file chưa bị xóa
  const { data: files, error: filesError } = await supabase
    .from('storage_files')
    .select('size_bytes')
    .eq('user_id', userId)
    .eq('is_deleted', false);

  if (filesError) {
    console.error('[StorageService:recalculateUserQuota] Lỗi query files:', filesError.message);
  }

  const fileCount = files ? files.length : 0;
  const usedBytes = (files || []).reduce((acc, curr) => acc + (parseInt(curr.size_bytes, 10) || 0), 0);
  const { data: existingQuota } = await supabase.from('user_storage_quotas').select('quota_bytes').eq('user_id', userId).single();
  const quotaBytes = existingQuota && existingQuota.quota_bytes ? parseInt(existingQuota.quota_bytes, 10) : DEFAULT_QUOTA_BYTES;
  const percentage = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  // Lưu hoặc cập nhật vào bảng user_storage_quotas
  const { data: upsertData, error: upsertError } = await supabase
    .from('user_storage_quotas')
    .upsert({
      user_id: userId,
      used_bytes: usedBytes,
      quota_bytes: quotaBytes,
      file_count: fileCount,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (upsertError) {
    console.warn('[StorageService:recalculateUserQuota] Lỗi upsert quota:', upsertError.message);
  }

  return {
    userId,
    usedBytes,
    quotaBytes,
    fileCount,
    percentageUsed: percentage,
    availableBytes: Math.max(0, quotaBytes - usedBytes),
    isFull: usedBytes >= quotaBytes,
    updatedAt: upsertData?.updated_at || new Date().toISOString()
  };
}

/**
 * Kiểm tra xem người dùng còn đủ dung lượng để upload thêm file hay không
 */
async function checkQuotaAvailable(userId, additionalBytes) {
  const quota = await getUserQuota(userId);
  const nextBytes = quota.usedBytes + parseInt(additionalBytes || 0, 10);
  const allowed = nextBytes <= quota.quotaBytes;

  return {
    allowed,
    currentUsed: quota.usedBytes,
    additionalBytes,
    quotaBytes: quota.quotaBytes,
    availableBytes: quota.availableBytes,
    exceededBy: allowed ? 0 : nextBytes - quota.quotaBytes
  };
}

/**
 * Lấy danh sách file của người dùng
 */
async function getUserFiles(userId, { search, limit = 50, offset = 0 } = {}) {
  let query = supabase
    .from('storage_files')
    .select('*')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search && search.trim()) {
    query = query.ilike('original_name', `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

module.exports = {
  DEFAULT_QUOTA_BYTES,
  getUserQuota,
  recalculateUserQuota,
  checkQuotaAvailable,
  getUserFiles
};