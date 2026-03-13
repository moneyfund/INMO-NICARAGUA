const state = {
  user: null,
  unsubscribeProperties: null,
  map: null,
  mapMarker: null
};

const fallbackPhoto = 'assets/placeholder.svg';

function addDoc(collectionRef, payload) {
  return collectionRef.add(payload);
}

function updateDoc(docRef, payload) {
  return docRef.set(payload, { merge: true });
}

function deleteDoc(docRef) {
  return docRef.delete();
}


function getFirebaseOrNotify() {
  const client = window.inmoFirebase;
  if (!client?.enabled || !client.auth || !client.db) {
    setMessage('Firebase no está disponible en este entorno.');
    return null;
  }
  return client;
}

function setMessage(message) {
  const box = document.getElementById('dashboardMessage');
  if (box) box.textContent = message;
}

function authMarkup(user) {
  if (!user) return '<button type="button" id="googleLoginBtn">Ingresar con Google</button>';
  return `
    <div class="dashboard-user-chip">
      <img src="${user.photoURL || fallbackPhoto}" alt="${user.displayName || 'Agente'}">
      <span>${user.displayName || user.email || 'Agente'}</span>
      <button type="button" id="logoutBtn">Cerrar sesión</button>
    </div>
  `;
}

function getProfilePayload(user) {
  return {
    name: document.getElementById('agentName').value.trim() || user.displayName || 'Agente INMO NICARAGUA',
    photo: document.getElementById('agentPhoto').value.trim() || user.photoURL || fallbackPhoto,
    description: document.getElementById('agentDescription').value.trim(),
    email: document.getElementById('agentEmail').value.trim() || user.email || '',
    phone: document.getElementById('agentPhone').value.trim(),
    instagram: document.getElementById('agentInstagram').value.trim(),
    facebook: document.getElementById('agentFacebook').value.trim(),
    tiktok: document.getElementById('agentTiktok').value.trim(),
    whatsapp: document.getElementById('agentWhatsapp').value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

function resetPropertyForm() {
  document.getElementById('propertyForm').reset();
  document.getElementById('propertyDocId').value = '';
  setPropertyCoordinates(NaN, NaN);

  if (state.mapMarker && state.map) {
    state.map.removeLayer(state.mapMarker);
    state.mapMarker = null;
  }
}



function updateCoordinatesLabel(lat, lng) {
  const label = document.getElementById('propertyCoordinatesLabel');
  if (!label) return;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    label.textContent = 'Sin coordenadas seleccionadas.';
    return;
  }

  label.textContent = `Lat: ${lat.toFixed(6)} | Lng: ${lng.toFixed(6)}`;
}

function setPropertyCoordinates(lat, lng) {
  const latInput = document.getElementById('propertyLat');
  const lngInput = document.getElementById('propertyLng');

  if (!latInput || !lngInput) return;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    latInput.value = '';
    lngInput.value = '';
    updateCoordinatesLabel(NaN, NaN);
    return;
  }

  latInput.value = String(lat);
  lngInput.value = String(lng);
  updateCoordinatesLabel(lat, lng);
}

function setPropertyMapMarker(lat, lng) {
  if (!state.map || typeof L === 'undefined' || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const point = [lat, lng];
  if (!state.mapMarker) {
    state.mapMarker = L.marker(point).addTo(state.map);
  } else {
    state.mapMarker.setLatLng(point);
  }

  state.map.setView(point, 14);
}

function initPropertyLocationMap() {
  const mapElement = document.getElementById('propertyLocationMap');
  if (!mapElement || typeof L === 'undefined') return;

  const defaultPoint = [12.8654, -85.2072];
  state.map = L.map(mapElement).setView(defaultPoint, 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.map);

  state.map.on('click', (event) => {
    const { lat, lng } = event.latlng;
    setPropertyCoordinates(lat, lng);
    setPropertyMapMarker(lat, lng);
  });

  setPropertyCoordinates(NaN, NaN);
}

function getPropertyPayload(user, profileName) {
  const images = document.getElementById('propertyImages').value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  const lat = Number(document.getElementById('propertyLat').value);
  const lng = Number(document.getElementById('propertyLng').value);

  return {
    title: document.getElementById('propertyTitle').value.trim(),
    titulo: document.getElementById('propertyTitle').value.trim(),
    price: Number(document.getElementById('propertyPrice').value || 0),
    precio: Number(document.getElementById('propertyPrice').value || 0),
    images,
    image: images[0] || fallbackPhoto,
    video: document.getElementById('propertyVideo').value.trim(),
    location: document.getElementById('propertyLocation').value.trim(),
    ubicacion: document.getElementById('propertyLocation').value.trim(),
    description: document.getElementById('propertyDescription').value.trim(),
    descripcion: document.getElementById('propertyDescription').value.trim(),
    type: document.getElementById('propertyType').value.trim(),
    tipo: document.getElementById('propertyType').value.trim(),
    bedrooms: Number(document.getElementById('propertyBedrooms').value || 0),
    habitaciones: Number(document.getElementById('propertyBedrooms').value || 0),
    bathrooms: Number(document.getElementById('propertyBathrooms').value || 0),
    banos: Number(document.getElementById('propertyBathrooms').value || 0),
    area: Number(document.getElementById('propertyArea').value || 0),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    agentId: user.uid,
    agentName: profileName,
    status: 'available',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

function fillPropertyForm(property) {
  document.getElementById('propertyDocId').value = property.id;
  document.getElementById('propertyTitle').value = property.title || property.titulo || '';
  document.getElementById('propertyPrice').value = property.price || property.precio || '';
  document.getElementById('propertyLocation').value = property.location || property.ubicacion || '';
  document.getElementById('propertyDescription').value = property.description || property.descripcion || '';
  document.getElementById('propertyType').value = property.type || property.tipo || '';
  document.getElementById('propertyBedrooms').value = property.bedrooms || property.habitaciones || 0;
  document.getElementById('propertyBathrooms').value = property.bathrooms || property.banos || 0;
  document.getElementById('propertyArea').value = property.area || 0;
  document.getElementById('propertyVideo').value = property.video || '';
  document.getElementById('propertyImages').value = Array.isArray(property.images) ? property.images.join('\n') : '';

  const lat = Number(property.lat ?? property.latitude);
  const lng = Number(property.lng ?? property.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    setPropertyCoordinates(lat, lng);
    setPropertyMapMarker(lat, lng);
  } else {
    setPropertyCoordinates(NaN, NaN);
  }
}


function propertyCard(property) {
  const statusLabel = String(property.status || 'available').toLowerCase() === 'sold' ? 'VENDIDA' : 'DISPONIBLE';
  return `
    <article class="property-card">
      <img src="${property.image || property.images?.[0] || fallbackPhoto}" alt="${property.title || property.titulo || 'Propiedad'}">
      <div class="property-card-content">
        <h3>${property.title || property.titulo || 'Propiedad'}</h3>
        <p>${property.location || property.ubicacion || ''}</p>
        <p class="price">$${Number(property.price || property.precio || 0).toLocaleString()}</p>
        <p class="property-status-tag">${statusLabel}</p>
        <div class="agent-actions">
          <button type="button" data-edit-property="${property.id}">Editar</button>
          <button type="button" data-sold-property="${property.id}">Marcar vendida</button>
          <button type="button" data-delete-property="${property.id}">Eliminar</button>
        </div>
      </div>
    </article>
  `;
}

async function saveProfile(event) {
  event.preventDefault();
  const client = getFirebaseOrNotify();
  if (!client || !state.user) return;

  await client.db.collection('agents').doc(state.user.uid).set(getProfilePayload(state.user), { merge: true });
  setMessage('Perfil actualizado correctamente.');
}

async function saveProperty(event) {
  event.preventDefault();
  const client = getFirebaseOrNotify();
  if (!client || !state.user) return;

  const profileName = document.getElementById('agentName').value.trim() || state.user.displayName || 'Agente';
  const propertyId = document.getElementById('propertyDocId').value;
  const payload = getPropertyPayload(state.user, profileName);

  if (propertyId) {
    const ref = client.db.collection('properties').doc(propertyId);
    const current = await ref.get();
    if (!current.exists || current.data().agentId !== state.user.uid) {
      setMessage('No tienes permisos para editar esta propiedad.');
      return;
    }
    await updateDoc(ref, payload);
    setMessage('Propiedad actualizada.');
  } else {
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await addDoc(client.db.collection('properties'), payload);
    setMessage('Propiedad creada.');
  }

  resetPropertyForm();
}

async function markPropertyAsSold(propertyId) {
  const client = getFirebaseOrNotify();
  if (!client || !state.user || !propertyId) return;

  const ref = client.db.collection('properties').doc(propertyId);
  const doc = await ref.get();

  if (!doc.exists || doc.data().agentId !== state.user.uid) {
    setMessage('No tienes permisos para modificar esta propiedad.');
    return;
  }

  await updateDoc(ref, { status: 'sold', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  setMessage('Propiedad marcada como vendida.');
}

async function deleteProperty(propertyId) {
  const client = getFirebaseOrNotify();
  if (!client || !state.user || !propertyId) return;

  const ref = client.db.collection('properties').doc(propertyId);
  const propertyDoc = await ref.get();
  if (!propertyDoc.exists || propertyDoc.data().agentId !== state.user.uid) {
    setMessage('No tienes permisos para eliminar esta propiedad.');
    return;
  }

  await deleteDoc(ref);
  setMessage('Propiedad eliminada.');
}

async function loadProfile(user) {
  const client = getFirebaseOrNotify();
  if (!client) return;

  const doc = await client.db.collection('agents').doc(user.uid).get();
  const profile = doc.exists ? doc.data() : {};

  document.getElementById('agentName').value = profile.name || user.displayName || '';
  document.getElementById('agentPhoto').value = profile.photo || user.photoURL || '';
  document.getElementById('agentDescription').value = profile.description || '';
  document.getElementById('agentEmail').value = profile.email || user.email || '';
  document.getElementById('agentPhone').value = profile.phone || '';
  document.getElementById('agentInstagram').value = profile.instagram || '';
  document.getElementById('agentFacebook').value = profile.facebook || '';
  document.getElementById('agentTiktok').value = profile.tiktok || '';
  document.getElementById('agentWhatsapp').value = profile.whatsapp || '';
}

function listenOwnProperties(user) {
  const client = getFirebaseOrNotify();
  if (!client) return;

  if (state.unsubscribeProperties) state.unsubscribeProperties();

  state.unsubscribeProperties = client.db.collection('properties')
    .where('agentId', '==', user.uid)
    .onSnapshot((snapshot) => {
      const properties = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      const list = document.getElementById('agentPropertiesList');
      const card = document.getElementById('agentPropertiesCard');

      card.classList.remove('hidden');
      list.innerHTML = properties.length
        ? properties.map(propertyCard).join('')
        : '<p class="empty-state">Todavía no tienes propiedades registradas.</p>';

      list.querySelectorAll('[data-edit-property]').forEach((button) => {
        button.addEventListener('click', () => {
          const selected = properties.find((property) => property.id === button.dataset.editProperty);
          if (selected) fillPropertyForm(selected);
        });
      });

      list.querySelectorAll('[data-sold-property]').forEach((button) => {
        button.addEventListener('click', () => markPropertyAsSold(button.dataset.soldProperty));
      });

      list.querySelectorAll('[data-delete-property]').forEach((button) => {
        button.addEventListener('click', () => deleteProperty(button.dataset.deleteProperty));
      });
    });
}

function updateLayoutForAuth(user) {
  const dashboard = document.getElementById('agentDashboard');
  if (dashboard) dashboard.classList.toggle('hidden', !user);
  document.getElementById('agentPropertiesCard')?.classList.toggle('hidden', !user);
}

function bindAuthControls() {
  const client = getFirebaseOrNotify();
  if (!client) return;

  const authBox = document.getElementById('agentAuthBox');

  client.auth.onAuthStateChanged(async (user) => {
    state.user = user;
    authBox.innerHTML = authMarkup(user);
    updateLayoutForAuth(user);

    if (!user) {
      setMessage('Inicia sesión para administrar tu perfil y propiedades.');
      return;
    }

    await loadProfile(user);
    listenOwnProperties(user);
    setMessage('Sesión activa. Solo puedes editar tus propios datos.');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => client.auth.signOut());
  });

  authBox.addEventListener('click', async (event) => {
    if (event.target.id !== 'googleLoginBtn') return;
    try {
      await client.auth.signInWithPopup(client.provider);
    } catch (error) {
      console.error(error);
      setMessage('No fue posible iniciar sesión con Google.');
    }
  });
}

function init() {
  document.getElementById('agentProfileForm')?.addEventListener('submit', saveProfile);
  document.getElementById('propertyForm')?.addEventListener('submit', saveProperty);
  initPropertyLocationMap();
  bindAuthControls();
}

window.addEventListener('DOMContentLoaded', init);
