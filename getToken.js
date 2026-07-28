require('dotenv').config();
const supabase = require('./src/config/supabase');

async function getToken() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'verify123@gmail.com')
    .single();
  
  if (error) {
    console.error(error);
  } else {
    console.log("USER:", data);
  }
}

getToken();
