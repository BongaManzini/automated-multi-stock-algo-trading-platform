import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use the custom databaseId if specified in the config
const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
const db = getFirestore(app, dbId);

export { app, auth, db };
