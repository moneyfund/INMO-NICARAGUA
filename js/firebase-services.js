import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const FIREBASE_APP_NAME = 'inmo-static-web';

const firebaseConfig = {
  apiKey: 'AIzaSyCVL7tpUkyQWz_aVr9wFi2hrCBum2pLnPs',
  authDomain: 'inmo-nicaragua.firebaseapp.com',
  projectId: 'inmo-nicaragua',
  storageBucket: 'inmo-nicaragua.firebasestorage.app',
  messagingSenderId: '735319266898',
  appId: '1:735319266898:web:124c3b886d0eb32a25b18b',
  measurementId: 'G-DXTBSYNR95'
};

const storageBucketUrl = `gs://${firebaseConfig.storageBucket}`;

const app = getApps().find((firebaseApp) => firebaseApp.name === FIREBASE_APP_NAME)
  || initializeApp(firebaseConfig, FIREBASE_APP_NAME);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app, storageBucketUrl);

export {
  app,
  auth,
  provider,
  db,
  storage,
  firebaseConfig,
  storageBucketUrl,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL
};
