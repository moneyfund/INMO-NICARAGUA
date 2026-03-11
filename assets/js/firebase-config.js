import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'REEMPLAZAR_API_KEY',
  authDomain: 'REEMPLAZAR_AUTH_DOMAIN',
  projectId: 'REEMPLAZAR_PROJECT_ID',
  storageBucket: 'REEMPLAZAR_STORAGE_BUCKET',
  messagingSenderId: 'REEMPLAZAR_MESSAGING_SENDER_ID',
  appId: 'REEMPLAZAR_APP_ID'
};

let app = null;
let auth = null;
let db = null;
let firebaseError = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  firebaseError = error;
  console.error('Firebase no pudo inicializarse.', error);
}

const googleProvider = new GoogleAuthProvider();

export {
  app,
  auth,
  db,
  googleProvider,
  firebaseError
};
