const storageService = require('../services/storageService');

/**
 * Lấy hạn mức và dung lượng đã sử dụng của người dùng hiện tại
 */
exports.getQuota = async (req, res) => {
  try {
    const userId = req.user.id;
    const quota = await storageService.getUserQuota(userId);
    return res.status(200).json(quota);
  } catch (error) {
    console.error('[StorageController:getQuota] Error:', error);
    return res.status(500).json({ error: 'Lỗi khi lấy thông tin dung lượng', details: error.message });
  }
};

/**
 * Kiểm tra xem file có thể upload được hay vượt quá dung lượng
 */
exports.checkQuota = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileSize } = req.body;
    
    if (!fileSize || fileSize <= 0) {
      return res.status(400).json({ error: 'fileSize không hợp lệ' });
    }

    const check = await storageService.checkQuotaAvailable(userId, fileSize);
    return res.status(200).json(check);
  } catch (error) {
    console.error('[StorageController:checkQuota] Error:', error);
    return res.status(500).json({ error: 'Lỗi khi kiểm tra hạn mức', details: error.message });
  }
};

/**
 * Lấy danh sách hình ảnh đã lưu trữ của người dùng
 */
exports.getFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const { search, limit, offset } = req.query;
    const files = await storageService.getUserFiles(userId, {
      search,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0
    });
    return res.status(200).json(files);
  } catch (error) {
    console.error('[StorageController:getFiles] Error:', error);
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách file', details: error.message });
  }
};