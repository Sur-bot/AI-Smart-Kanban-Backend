const fs = require('fs');
let content = fs.readFileSync('src/worker.js', 'utf8');
const regex = /const \{ error: dbError \} = await supabase\s*\.from\('storage_files'\)\s*\.update\(\{/;
const replacement = `const { data: checkDeleted } = await supabase.from('storage_files').select('is_deleted').eq('id', fileId).single();
    if (checkDeleted && checkDeleted.is_deleted) {
      await supabase.storage.from(BUCKET_NAME).remove([newStorageKey, thumbnailKey]);
      console.log(\`[Worker] File \${fileId} đã bị xóa trước khi hoàn thành. Đã dọn dẹp WebP.\`);
      return { success: true, message: 'File was deleted during processing' };
    }

    const { error: dbError } = await supabase
      .from('storage_files')
      .update({`;
content = content.replace(regex, replacement);
fs.writeFileSync('src/worker.js', content, 'utf8');
