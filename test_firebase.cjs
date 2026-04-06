const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
admin.initializeApp({
  projectId: 'gen-lang-client-0969674405'
});
const db = getFirestore(admin.app(), 'ai-studio-f915f8d0-4ac0-447e-8d9c-45cdda0a396a');
db.collection('test').get().then(() => console.log('Success')).catch(e => console.error(e));
