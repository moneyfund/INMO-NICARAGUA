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
    window.inmoFirebase = {
      enabled: false,
      db: null,
      auth: null,
      provider: null
    };
    return;
  }

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);

  window.inmoFirebase = {
    enabled: true,
    app,
    db: firebase.firestore(),
    auth: firebase.auth(),
    provider: new firebase.auth.GoogleAuthProvider()
  };
})();
