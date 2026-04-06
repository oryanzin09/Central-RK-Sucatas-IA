const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');

async function test() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] });
  const token = await auth.getAccessToken();
  console.log('Token:', token.substring(0, 10) + '...');
  
  try {
    const res = await axios.get('https://firestore.googleapis.com/v1/projects/gen-lang-client-0969674405/databases/ai-studio-f915f8d0-4ac0-447e-8d9c-45cdda0a396a/documents/test', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Success:', res.data);
  } catch (e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  }
}
test();
