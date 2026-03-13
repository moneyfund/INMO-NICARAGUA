const ALLOWED_ADMIN_EMAIL = 'norvingarcia@gmail.com';

function getFirebaseClient() {
  const client = window.inmoFirebase;
  if (!client?.enabled || !client.auth) {
    return null;
  }
  return client;
}

function hasAllowedAdminEmail(user) {
  const userEmail = String(user?.email || '').trim().toLowerCase();
  return userEmail === ALLOWED_ADMIN_EMAIL;
}

function redirectTo(path) {
  window.location.replace(path);
}

function readLoginError() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('error');

  if (reason === 'not-authorized') {
    return 'Tu cuenta no tiene permisos de administrador.';
  }

  if (reason === 'auth-failed') {
    return 'No fue posible validar la sesión. Inténtalo nuevamente.';
  }

  return '';
}

async function loginAsAdmin(client) {
  const result = await client.auth.signInWithPopup(client.provider);
  const user = result?.user;

  if (!user) {
    throw new Error('No authenticated user returned by Google sign-in.');
  }

  if (!hasAllowedAdminEmail(user)) {
    throw new Error('User does not have admin role.');
  }

  redirectTo('admin.html');
}

async function syncExistingSession(client, loginError) {
  const user = client.auth.currentUser;
  if (!user) return;

  try {
    if (hasAllowedAdminEmail(user)) {
      redirectTo('admin.html');
      return;
    }

    if (loginError) loginError.textContent = 'Tu cuenta no tiene permisos de administrador.';
  } catch (error) {
    console.error('No fue posible validar la sesión actual.', error);
  }
}

function initAdminLogin() {
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('googleLoginBtn');
  const client = getFirebaseClient();

  if (!client) {
    if (loginError) loginError.textContent = 'Firebase no está disponible en este entorno.';
    return;
  }

  syncExistingSession(client, loginError);

  const initialError = readLoginError();
  if (loginError && initialError) {
    loginError.textContent = initialError;
  }

  loginBtn?.addEventListener('click', async () => {
    if (loginError) loginError.textContent = '';

    try {
      await loginAsAdmin(client);
    } catch (error) {
      console.error(error);
      if (loginError) {
        loginError.textContent = 'Access denied. Solo está permitida la cuenta norvingarcia@gmail.com.';
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', initAdminLogin);
