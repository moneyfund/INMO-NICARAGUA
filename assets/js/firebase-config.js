// Import Firebase modules desde CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

// Configuración de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCVL7tpUkyQWz_aVr9wFi2hrCBum2pLnPs",
  authDomain: "inmo-nicaragua.firebaseapp.com",
  projectId: "inmo-nicaragua",
  storageBucket: "inmo-nicaragua.firebasestorage.app",
  messagingSenderId: "735319266898",
  appId: "1:735319266898:web:124c3b886d0eb32a25b18b",
  measurementId: "G-DXTBSYNR95"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const analytics = getAnalytics(app);
const firebaseError = null;

// Exportar para usar en otros archivos
export { auth, googleProvider, db, analytics, firebaseError };
