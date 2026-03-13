function getFirebaseClient() {
  const client = window.inmoFirebase;
  if (!client?.enabled || !client.auth || !client.db) {
    return null;
  }
  return client;
}

async function isAdminUser(client, user) {
  if (!user) return false;
  const agentDoc = await client.db.collection('agents').doc(user.uid).get();
  if (!agentDoc.exists) return false;
  return String(agentDoc.data().role || '').toLowerCase() === 'admin';
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

  client.auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    try {
      const allowed = await isAdminUser(client, user);
      if (allowed) {
        redirectTo('admin.html');
        return;
      }

      redirectTo('access-denied.html');
    } catch (error) {
      console.error(error);
      if (loginError) loginError.textContent = 'No se pudo validar tu rol de acceso.';
    }
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
