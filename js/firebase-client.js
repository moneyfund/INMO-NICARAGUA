(function initFirebaseClient() {
  if (typeof window === 'undefined') return;
  if (window.inmoFirebase) return;

  const firebaseConfig = {
    apiKey: 'AIzaSyCVL7tpUkyQWz_aVr9wFi2hrCBum2pLnPs',
    authDomain: 'inmo-nicaragua.firebaseapp.com',
    projectId: 'inmo-nicaragua',
    storageBucket: 'inmo-nicaragua.firebasestorage.app',
    messagingSenderId: '735319266898',
    appId: '1:735319266898:web:124c3b886d0eb32a25b18b',
    measurementId: 'G-DXTBSYNR95'
  };

  if (!window.firebase || !firebaseConfig.projectId) {
    console.warn('[Firebase] SDK compat no disponible o configuración incompleta.');
    window.inmoFirebase = {
      enabled: false,
      db: null,
      auth: null,
      provider: null
    };
    document.dispatchEvent(new CustomEvent('inmo:firebase-ready', { detail: window.inmoFirebase }));
    return;
  }

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const authAvailable = typeof firebase.auth === 'function';

  console.info(`[Firebase] Inicializado en proyecto: ${firebaseConfig.projectId}`);
  console.info('[Firebase] Servicios activos:', {
    auth: authAvailable,
    firestore: typeof firebase.firestore === 'function'
  });

  window.inmoFirebase = {
    enabled: true,
    app,
    db: firebase.firestore(),
    auth: authAvailable ? firebase.auth() : null,
    provider: authAvailable ? new firebase.auth.GoogleAuthProvider() : null,
    currentUser: null
  };

  if (window.inmoFirebase.auth) {
    window.inmoFirebase.auth.onAuthStateChanged((user) => {
      window.inmoFirebase.currentUser = user;
      console.log('[Firebase] user login state:', user ? { uid: user.uid, email: user.email } : null);
      document.dispatchEvent(new CustomEvent('inmo:auth-changed', { detail: { user } }));
    });
  }

  document.dispatchEvent(new CustomEvent('inmo:firebase-ready', { detail: window.inmoFirebase }));
})();
