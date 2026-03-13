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

function initAdminLogin() {
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('googleLoginBtn');
  const client = getFirebaseClient();

  if (!client) {
    if (loginError) loginError.textContent = 'Firebase no está disponible en este entorno.';
    return;
  }

  client.auth.onAuthStateChanged((user) => {
    if (!user) return;
    redirectTo('admin.html');
  });

  loginBtn?.addEventListener('click', async () => {
    try {
      await client.auth.signInWithPopup(client.provider);
    } catch (error) {
      console.error(error);
      if (loginError) loginError.textContent = 'No fue posible iniciar sesión con Google.';
    }
  });
}

window.addEventListener('DOMContentLoaded', initAdminLogin);
