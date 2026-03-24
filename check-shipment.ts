import { mlClient } from './server.ts'; // Wait, I can't import mlClient directly like this if it's not exported.

// I'll just write a script that uses the token.
import fs from 'fs';

const token = fs.readFileSync('.ml_token', 'utf-8');

async function check() {
  const res = await fetch('https://api.mercadolibre.com/shipments/46684182477', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-format-new': 'true'
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

check();
