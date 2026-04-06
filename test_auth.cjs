const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'gen-lang-client-0969674405'
});
admin.auth().verifyIdToken('fake-token').then(() => console.log('Success')).catch(e => console.log('Error as expected:', e.message));
