const axios = require('axios');

async function testFlow() {
  try {
    const email = `test_${Date.now()}@gmail.com`;
    console.log(`Registering ${email}...`);
    const regRes = await axios.post('http://localhost:3000/api/auth/register', {
      email,
      password: 'Password123'
    });
    
    console.log('Register Response:', regRes.data);
    
    // Now fetch token from DB
    const supabase = require('./src/config/supabase');
    const { data } = await supabase.from('users').select('verification_token, is_verified').eq('email', email).single();
    
    console.log('Token in DB:', data.verification_token);
    console.log('Is Verified:', data.is_verified);
    
  } catch (error) {
    console.error('Error Response Data:', error.response?.data);
    console.error('Error Status:', error.response?.status);
    console.error('Error Message:', error.message);
  }
}

testFlow();
