const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: deletedFiles } = await supabase.from('storage_files').select('storage_key, thumbnail_key').eq('is_deleted', true);
  if (!deletedFiles || deletedFiles.length === 0) return console.log('Không có file nào bị đánh dấu xóa mồ côi.');
  
  let keysToDelete = [];
  deletedFiles.forEach(file => {
    if (file.storage_key) keysToDelete.push(file.storage_key);
    if (file.thumbnail_key) keysToDelete.push(file.thumbnail_key);
    // Nếu storage_key đang là .png, thì có thể worker đã tải lên .webp nhưng chưa kịp cập nhật DB.
    // Ta add thêm đường dẫn webp để xóa cho chắc ăn.
    const webpKey = file.storage_key.replace(/\.[^/.]+$/, "") + '.webp';
    const thumbKey = file.storage_key.replace(/\.[^/.]+$/, "") + '_thumb.webp';
    if (!keysToDelete.includes(webpKey)) keysToDelete.push(webpKey);
    if (!keysToDelete.includes(thumbKey)) keysToDelete.push(thumbKey);
  });

  if (keysToDelete.length > 0) {
    const { data, error } = await supabase.storage.from('ai-kanban-storage').remove(keysToDelete);
    if (error) {
      console.error('Lỗi khi dọn dẹp:', error.message);
    } else {
      console.log('Đã dọn dẹp', data.length, 'file rác thành công!');
    }
  }
}
run();
