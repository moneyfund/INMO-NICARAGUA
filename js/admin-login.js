function getFirebaseClient() {
  const client = window.inmoFirebase;
  if (!client?.enabled || !client.auth || !client.db) {
    return null;
  }
  return client;
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

  const agentDoc = await client.db.collection('agents').doc(user.uid).get();
  const isAdmin = agentDoc.exists && String(agentDoc.data().role || '').toLowerCase() === 'admin';

  if (!isAdmin) {
    await client.auth.signOut();
    throw new Error('User does not have admin role.');
  }

  redirectTo('admin.html');
}

async function syncExistingSession(client, loginError) {
  const user = client.auth.currentUser;
  if (!user) return;

  try {
    const agentDoc = await client.db.collection('agents').doc(user.uid).get();
    const isAdmin = agentDoc.exists && String(agentDoc.data().role || '').toLowerCase() === 'admin';

    if (isAdmin) {
      redirectTo('admin.html');
      return;
    }

    await client.auth.signOut();
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
        loginError.textContent = 'Solo administradores pueden iniciar sesión en este panel.';
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', initAdminLogin);
