const sellerForm = document.getElementById('sellerForm');
const sellerAuthMessage = document.getElementById('sellerAuthMessage');
const sellerAgentSelect = document.getElementById('sellerAgentSelect');
const sellerAgentMessage = document.getElementById('sellerAgentMessage');
const sellerWhatsappBtn = document.getElementById('sellerWhatsappBtn');

const sellerWhatsappDefaultMessage = 'Hola, quiero vender mi propiedad y deseo más información.';
const sellerAgentState = {
  agents: []
};

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

function setAgentMessage(message, isError = false) {
  if (!sellerAgentMessage) return;

  sellerAgentMessage.textContent = message;
  sellerAgentMessage.classList.toggle('is-error', isError);
}

function sanitizePhoneNumber(phone) {
  return String(phone || '').replace(/\D+/g, '');
}

function getAgentWhatsappNumber(agent) {
  if (!agent) return '';

  if (agent.phone) {
    const phone = sanitizePhoneNumber(agent.phone);
    if (phone) return phone;
  }

  if (agent.whatsapp) {
    const raw = String(agent.whatsapp).trim();

    if (raw.includes('wa.me/') || raw.includes('api.whatsapp.com')) {
      try {
        const parsed = new URL(raw);
        const pathPhone = parsed.pathname.replace(/\//g, '');
        const fromPath = sanitizePhoneNumber(pathPhone);
        if (fromPath) return fromPath;

        const fromText = sanitizePhoneNumber(parsed.searchParams.get('phone') || '');
        if (fromText) return fromText;
      } catch (error) {
        const fallback = sanitizePhoneNumber(raw);
        if (fallback) return fallback;
      }
    }

    const numeric = sanitizePhoneNumber(raw);
    if (numeric) return numeric;
  }

  return '';
}

function getSelectedAgent() {
  if (!sellerAgentSelect) return null;
  const selectedId = sellerAgentSelect.value;
  return sellerAgentState.agents.find((agent) => agent.id === selectedId) || null;
}

function updateWhatsappButtonLink() {
  if (!sellerWhatsappBtn) return;

  const selectedAgent = getSelectedAgent();
  const phone = getAgentWhatsappNumber(selectedAgent);

  if (!phone) {
    sellerWhatsappBtn.setAttribute('href', '#');
    sellerWhatsappBtn.setAttribute('aria-disabled', 'true');
    sellerWhatsappBtn.classList.add('is-disabled');
    setAgentMessage('Selecciona un asesor disponible para iniciar el chat por WhatsApp.', true);
    return;
  }

  const message = encodeURIComponent(sellerWhatsappDefaultMessage);
  sellerWhatsappBtn.setAttribute('href', `https://wa.me/${phone}?text=${message}`);
  sellerWhatsappBtn.removeAttribute('aria-disabled');
  sellerWhatsappBtn.classList.remove('is-disabled');
  setAgentMessage('');
}

async function loadSellerAgents() {
  if (!sellerAgentSelect) return;

  const client = getFirebaseClient();
  if (!client || !client.enabled || !client.db) {
    sellerAgentSelect.innerHTML = '<option value="">Asesores no disponibles</option>';
    sellerAgentSelect.disabled = true;
    setAgentMessage('No fue posible cargar los asesores en este momento.', true);
    updateWhatsappButtonLink();
    return;
  }

  try {
    const snapshot = await client.db.collection('agents').get();
    const agents = snapshot.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }))
      .filter((agent) => agent.name && getAgentWhatsappNumber(agent));

    sellerAgentState.agents = agents;

    if (!agents.length) {
      sellerAgentSelect.innerHTML = '<option value="">No hay asesores disponibles</option>';
      sellerAgentSelect.disabled = true;
      setAgentMessage('No hay asesores disponibles para WhatsApp en este momento.', true);
      updateWhatsappButtonLink();
      return;
    }

    sellerAgentSelect.innerHTML = [
      '<option value="">Selecciona un asesor</option>',
      ...agents.map((agent) => `<option value="${agent.id}">${agent.name}</option>`)
    ].join('');
    sellerAgentSelect.disabled = false;
    updateWhatsappButtonLink();
  } catch (error) {
    console.error('No fue posible cargar los agentes para WhatsApp.', error);
    sellerAgentSelect.innerHTML = '<option value="">Asesores no disponibles</option>';
    sellerAgentSelect.disabled = true;
    setAgentMessage('No fue posible cargar los asesores en este momento.', true);
    updateWhatsappButtonLink();
  }
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

if (sellerAgentSelect && sellerWhatsappBtn) {
  sellerAgentSelect.addEventListener('change', () => {
    updateWhatsappButtonLink();
  });

  sellerWhatsappBtn.addEventListener('click', (event) => {
    if (sellerWhatsappBtn.classList.contains('is-disabled')) {
      event.preventDefault();
    }
  });

  if (window.inmoFirebase) {
    loadSellerAgents();
  } else {
    document.addEventListener('inmo:firebase-ready', loadSellerAgents, { once: true });
  }

  updateWhatsappButtonLink();
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
