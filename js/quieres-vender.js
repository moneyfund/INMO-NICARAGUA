const sellerForm = document.getElementById('sellerForm');
const sellerAuthMessage = document.getElementById('sellerAuthMessage');

function getFirebaseClient() {
  if (typeof window === 'undefined') return null;
  return window.inmoFirebase || null;
}

function getCurrentUser() {
  return window.inmoAuthState?.currentUser || null;
}

function setAuthMessage(message, isError = false) {
  if (!sellerAuthMessage) return;

  sellerAuthMessage.textContent = message;
  sellerAuthMessage.classList.toggle('is-error', isError);
}

function setAuthReadyMessage() {
  const client = getFirebaseClient();

  if (!client || !client.enabled || !client.auth) {
    setAuthMessage('El inicio de sesión con Google no está disponible en este momento.', true);
    return;
  }

  const currentUser = getCurrentUser() || client.auth.currentUser;
  if (currentUser) {
    const displayName = currentUser.displayName || 'Usuario';
    setAuthMessage(`Sesión iniciada como ${displayName}. Ya puedes enviar el formulario.`);
    return;
  }

  setAuthMessage('Debes iniciar sesión con Google antes de enviar la información.', true);
}

async function requestGoogleSignIn(client) {
  try {
    await client.auth.signInWithPopup(client.provider);
    return true;
  } catch (error) {
    console.error('No fue posible iniciar sesión con Google.', error);
    setAuthMessage('No fue posible iniciar sesión con Google. Intenta nuevamente.', true);
    return false;
  }
}

if (sellerForm) {
  sellerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const client = getFirebaseClient();

    if (!client || !client.enabled || !client.auth || !client.provider) {
      setAuthMessage('No se pudo validar la sesión. Recarga la página e intenta nuevamente.', true);
      return;
    }

    const currentUser = getCurrentUser() || client.auth.currentUser;
    if (!currentUser) {
      setAuthMessage('Para continuar, inicia sesión con tu cuenta de Google.', true);
      const didSignIn = await requestGoogleSignIn(client);
      if (!didSignIn || !(getCurrentUser() || client.auth.currentUser)) return;
    }

    try {
      await client.db.collection('sellerRequests').add({
        userId: (getCurrentUser() || client.auth.currentUser).uid,
        userName: (getCurrentUser() || client.auth.currentUser).displayName || '',
        userEmail: (getCurrentUser() || client.auth.currentUser).email || '',
        name: sellerForm.querySelector('[name="name"]')?.value.trim() || '',
        phone: sellerForm.querySelector('[name="phone"]')?.value.trim() || '',
        email: sellerForm.querySelector('[name="email"]')?.value.trim() || '',
        listingType: sellerForm.querySelector('[name="listing-type"]')?.value || '',
        propertyType: sellerForm.querySelector('[name="property-type"]')?.value || '',
        location: sellerForm.querySelector('[name="city"]')?.value.trim() || '',
        details: sellerForm.querySelector('[name="message"]')?.value.trim() || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      setAuthMessage('Gracias por tu información. Nuestro equipo te contactará pronto.');
      sellerForm.reset();
    } catch (error) {
      console.error('No se pudo guardar la solicitud de venta.', error);
      setAuthMessage('No se pudo enviar la solicitud. Intenta nuevamente.', true);
    }
  });

  document.addEventListener('inmo:auth-state-changed', setAuthReadyMessage);

  if (!window.inmoFirebase) {
    document.addEventListener('inmo:firebase-ready', setAuthReadyMessage, { once: true });
  }

  setAuthReadyMessage();
}
