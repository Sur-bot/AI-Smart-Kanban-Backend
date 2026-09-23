const supabase = require('./src/config/supabase');
async function test() {
  const { data, error } = await supabase.from('projects').select('id').in('id', []);
  console.log('Result data:', JSON.stringify(data));
  console.log('Result error:', JSON.stringify(error));
}
test();
