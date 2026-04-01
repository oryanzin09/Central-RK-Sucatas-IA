
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
const db = new Database(dbPath);

const users = db.prepare('SELECT id, phone, name, role FROM users').all();
console.log('--- USERS (Staff) ---');
console.table(users);

const clients = db.prepare('SELECT id, phone, name FROM clients').all();
console.log('--- CLIENTS ---');
console.table(clients);
