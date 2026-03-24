import 'dotenv/config';
import mlClient from './services/mlClient.js';

async function check() {
  console.log('ML_USER_ID:', process.env.ML_USER_ID);
  try {
    const res = await mlClient.request('/shipments/46684182477', {
      headers: { 'x-format-new': 'true' }
    });
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
}

check();
