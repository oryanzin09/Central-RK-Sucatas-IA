import fetch from 'node-fetch';

async function check() {
  const res = await fetch('http://localhost:3000/api/ml/sales');
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

check();
