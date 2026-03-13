const ALLOWED_ADMIN_EMAIL = 'norvingarcia220@gmail.com';

const loginState = {
  authListenerAttached: false,
  signingIn: false
};

function getFirebaseClient() {
  const client = window.inmoFirebase;
  if (!client?.enabled || !client.auth) {
    return null;
  }
  return client;
}

function getUserEmail(user) {
  return String(user?.email || '').trim().toLowerCase();
}

function hasAllowedAdminEmail(user) {
  return getUserEmail(user) === ALLOWED_ADMIN_EMAIL;
}

function redirectTo(path) {
  window.location.replace(path);
}

function readLoginError() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('error');

  if (reason === 'not-authorized') {
    return 'Access denied – Admins only';
  }

  if (reason === 'auth-failed') {
    return 'No fue posible validar la sesión. Inténtalo nuevamente.';
  }

  return '';
}

function setLoginMessage(loginError, message = '') {
  if (!loginError) return;
  loginError.textContent = message;
}

function verifyCurrentUser(user, loginError) {
  const email = getUserEmail(user);
  const adminAllowed = hasAllowedAdminEmail(user);

  console.log('[admin-login] user email:', email || 'none');
  console.log('[admin-login] login state:', Boolean(user));
  console.log('[admin-login] admin verification:', adminAllowed);

  if (!user) {
    return;
  }

  if (adminAllowed) {
    redirectTo('admin.html');
    return;
  }

  setLoginMessage(loginError, 'Access denied – Admins only');
}

async function loginAsAdmin(client, loginError) {
  if (loginState.signingIn) return;

  loginState.signingIn = true;
  setLoginMessage(loginError, '');

  try {
    const GoogleAuthProvider = firebase.auth.GoogleAuthProvider;
    const signInWithPopup = (auth, provider) => auth.signInWithPopup(provider);
    const result = await signInWithPopup(client.auth, new GoogleAuthProvider());
    const user = result?.user;

    if (!user) {
      throw new Error('No authenticated user returned by Google sign-in.');
    }

    verifyCurrentUser(user, loginError);
  } catch (error) {
    console.error('[admin-login] sign in failed:', error);
    setLoginMessage(loginError, 'No fue posible iniciar sesión con Google. Inténtalo de nuevo.');
  } finally {
    loginState.signingIn = false;
  }
}

function initAdminLogin() {
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('googleLoginBtn');
  const client = getFirebaseClient();

  if (!client) {
    setLoginMessage(loginError, 'Firebase no está disponible en este entorno.');
    return;
  }

  const initialError = readLoginError();
  if (initialError) {
    setLoginMessage(loginError, initialError);
  }

  if (!loginState.authListenerAttached) {
    loginState.authListenerAttached = true;

    client.auth.onAuthStateChanged((user) => {
      if (loginState.signingIn) return;
      verifyCurrentUser(user, loginError);
    });
  }

  loginBtn?.addEventListener('click', async () => {
    await loginAsAdmin(client, loginError);
  });
}

window.addEventListener('DOMContentLoaded', initAdminLogin);
