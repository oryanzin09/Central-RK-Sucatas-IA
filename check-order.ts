import 'dotenv/config';
import mlClient from './services/mlClient';

async function check() {
  console.log('TOKEN:', process.env.ML_ACCESS_TOKEN ? 'EXISTS' : 'EMPTY');
  try {
    const order = await mlClient.request('/orders/2000015614957750');
    console.log(JSON.stringify(order, null, 2));
  } catch (err) {
    console.error(err);
  }
}

check();
