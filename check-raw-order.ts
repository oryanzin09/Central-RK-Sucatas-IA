import fetch from 'node-fetch';

async function check() {
  const res = await fetch('http://localhost:3000/api/ml/sales');
  // Wait, I can't get the raw order from this endpoint.
}
