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

async function resolveAdminRedirect(client, user) {
  if (!user) return;

  try {
    const agentDoc = await client.db.collection('agents').doc(user.uid).get();
    const isAdmin = agentDoc.exists && String(agentDoc.data().role || '').toLowerCase() === 'admin';
    redirectTo(isAdmin ? 'admin.html' : 'access-denied.html');
  } catch (error) {
    console.error(error);
    redirectTo('access-denied.html');
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

  client.auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    await resolveAdminRedirect(client, user);
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
