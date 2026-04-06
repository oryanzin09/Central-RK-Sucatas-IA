const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'gen-lang-client-0969674405'
});
const db = admin.firestore();
db.settings({ databaseId: 'ai-studio-f915f8d0-4ac0-447e-8d9c-45cdda0a396a' });
db.collection('test').get().then(() => console.log('Success')).catch(e => console.error(e));
