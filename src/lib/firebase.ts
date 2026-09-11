import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

// Suppress verbose SDK connection retries to prevent noisy console logs
setLogLevel('error');

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
  measurementId: firebaseConfigData.measurementId,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use custom Firestore database ID if specified in config
const dbId = (firebaseConfigData as any).firestoreDatabaseId || '(default)';

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true,
  }, dbId);
} catch (e) {
  try {
    firestoreInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, dbId);
  } catch (e2) {
    firestoreInstance = getFirestore(app, dbId);
  }
}
export const db = firestoreInstance;

export const DEFAULT_BUSINESS_ID = 'main-bar-01';
