import {
  auth,
  provider,
  db,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from './firebase-services.js';

const state = {
  user: null,
  unsubscribeProperties: null,
  map: null,
  mapMarker: null,
  existingImages: []
};

const fallbackPhoto = 'assets/placeholder.svg';

function setMessage(message, type = 'info') {
  const box = document.getElementById('dashboardMessage');
  if (!box) return;
  box.textContent = message;
  box.dataset.type = type;
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
    updatedAt: serverTimestamp()
  };
}

function resetPropertyForm() {
  document.getElementById('propertyForm').reset();
  document.getElementById('propertyDocId').value = '';
  state.existingImages = [];
  setPropertyCoordinates(NaN, NaN);
  renderImagePreview();

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

function normalizeImageUrls(urls) {
  return Array.from(new Set(
    urls
      .map((url) => String(url || '').trim())
      .filter(Boolean)
  ));
}

function parseImageUrls(value) {
  return normalizeImageUrls(String(value || '').split(/[\n,]+/));
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateImageUrls(urls) {
  if (!urls.length) {
    throw new Error('Ingresa al menos una URL de imagen.');
  }

  const invalidUrls = urls.filter((url) => !isValidHttpUrl(url));
  if (invalidUrls.length) {
    throw new Error(`Estas URLs no son válidas: ${invalidUrls.join(', ')}`);
  }
}

function syncImageUrlsFromInput() {
  const input = document.getElementById('propertyImageUrls');
  if (!input) return [];

  const urls = parseImageUrls(input.value);
  state.existingImages = urls;
  renderImagePreview();
  return urls;
}

function updateImageUrlsInput(urls) {
  const input = document.getElementById('propertyImageUrls');
  if (!input) return;

  input.value = urls.join('\n');
  syncImageUrlsFromInput();
}

function getPropertyPayload(user, profileName, imagenes = state.existingImages) {
  const lat = Number(document.getElementById('propertyLat').value);
  const lng = Number(document.getElementById('propertyLng').value);
  const title = document.getElementById('propertyTitle').value.trim();
  const price = Number(document.getElementById('propertyPrice').value || 0);
  const description = document.getElementById('propertyDescription').value.trim();

  return {
    title,
    titulo: title,
    price,
    precio: price,
    descripcion: description,
    description,
    imagenes,
    images: imagenes,
    image: imagenes[0] || fallbackPhoto,
    video: document.getElementById('propertyVideo').value.trim(),
    location: document.getElementById('propertyLocation').value.trim(),
    ubicacion: document.getElementById('propertyLocation').value.trim(),
    type: document.getElementById('propertyType').value.trim(),
    tipo: document.getElementById('propertyType').value.trim(),
    bedrooms: Number(document.getElementById('propertyBedrooms').value || 0),
    habitaciones: Number(document.getElementById('propertyBedrooms').value || 0),
    bathrooms: Number(document.getElementById('propertyBathrooms').value || 0),
    banos: Number(document.getElementById('propertyBathrooms').value || 0),
    area: Number(document.getElementById('propertyArea').value || 0),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    agenteId: user.uid,
    agentId: user.uid,
    agentName: profileName,
    status: 'available',
    updatedAt: serverTimestamp()
  };
}

function renderImagePreview() {
  const container = document.getElementById('propertyImagesPreview');
  const totalLabel = document.getElementById('propertyImagesCounter');
  if (!container || !totalLabel) return;

  totalLabel.textContent = `${state.existingImages.length} URL(s) de imagen`;

  if (!state.existingImages.length) {
    container.innerHTML = '<p class="empty-state uploader-empty">Ingresa una o varias URLs para previsualizar las imágenes.</p>';
    return;
  }

  container.innerHTML = state.existingImages.map((url, index) => `
    <article class="image-preview-card is-uploaded">
      <img src="${url}" alt="Imagen ${index + 1}" loading="lazy" referrerpolicy="no-referrer">
      <div class="image-preview-meta">
        <strong>Imagen ${index + 1}</strong>
        <span>${url}</span>
      </div>
      <div class="image-preview-actions">
        <button type="button" data-remove-image-url="${encodeURIComponent(url)}">Eliminar</button>
      </div>
    </article>
  `).join('');
}

function bindImagePreviewActions() {
  const container = document.getElementById('propertyImagesPreview');
  if (!container) return;

  container.addEventListener('click', (event) => {
    const encodedUrl = event.target.dataset.removeImageUrl;
    if (!encodedUrl) return;

    const url = decodeURIComponent(encodedUrl);
    const nextUrls = state.existingImages.filter((imageUrl) => imageUrl !== url);
    updateImageUrlsInput(nextUrls);
  });
}

function bindImageUrlInput() {
  const input = document.getElementById('propertyImageUrls');
  if (!input) return;

  input.addEventListener('input', () => {
    syncImageUrlsFromInput();
  });
}

async function guardarPropiedad(data, imagenes, propertyId = '') {
  if (!state.user) throw new Error('Sesión no válida.');

  const payload = getPropertyPayload(state.user, data.agentName, imagenes);
  const propertiesCollection = collection(db, 'properties');

  if (propertyId) {
    const propertyRef = doc(db, 'properties', propertyId);
    const current = await getDoc(propertyRef);
    if (!current.exists() || current.data().agentId !== state.user.uid) {
      throw new Error('No tienes permisos para editar esta propiedad.');
    }
    await updateDoc(propertyRef, payload);
    return propertyRef;
  }

  return addDoc(propertiesCollection, {
    ...payload,
    createdAt: serverTimestamp()
  });
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
  state.existingImages = normalizeImageUrls(property.images || property.imagenes || []);
  updateImageUrlsInput(state.existingImages);

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
      <img src="${property.image || property.images?.[0] || property.imagenes?.[0] || fallbackPhoto}" alt="${property.title || property.titulo || 'Propiedad'}">
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
  if (!state.user) return;

  await setDoc(doc(db, 'agents', state.user.uid), getProfilePayload(state.user), { merge: true });
  setMessage('Perfil actualizado correctamente.', 'success');
}

async function saveProperty(event) {
  event.preventDefault();
  if (!state.user) return;

  const submitButton = event.submitter || document.querySelector('#propertyForm button[type="submit"]');
  const profileName = document.getElementById('agentName').value.trim() || state.user.displayName || 'Agente';
  const propertyId = document.getElementById('propertyDocId').value;

  try {
    submitButton?.setAttribute('disabled', 'disabled');
    submitButton?.classList.add('is-loading');

    const imageUrls = syncImageUrlsFromInput();
    validateImageUrls(imageUrls);
    setMessage('Guardando propiedad...', 'info');

    await guardarPropiedad({ agentName: profileName }, imageUrls, propertyId);

    setMessage(propertyId ? 'Propiedad actualizada correctamente.' : 'Propiedad creada correctamente.', 'success');
    resetPropertyForm();
  } catch (error) {
    console.error('[AgentDashboard] Error guardando propiedad.', error);
    setMessage(error.message || 'No fue posible guardar la propiedad.', 'error');
  } finally {
    submitButton?.removeAttribute('disabled');
    submitButton?.classList.remove('is-loading');
  }
}

async function markPropertyAsSold(propertyId) {
  if (!state.user || !propertyId) return;

  const refDoc = doc(db, 'properties', propertyId);
  const snapshot = await getDoc(refDoc);

  if (!snapshot.exists() || snapshot.data().agentId !== state.user.uid) {
    setMessage('No tienes permisos para modificar esta propiedad.', 'error');
    return;
  }

  await updateDoc(refDoc, { status: 'sold', updatedAt: serverTimestamp() });
  setMessage('Propiedad marcada como vendida.', 'success');
}

async function deleteProperty(propertyId) {
  if (!state.user || !propertyId) return;

  const refDoc = doc(db, 'properties', propertyId);
  const snapshot = await getDoc(refDoc);
  if (!snapshot.exists() || snapshot.data().agentId !== state.user.uid) {
    setMessage('No tienes permisos para eliminar esta propiedad.', 'error');
    return;
  }

  await deleteDoc(refDoc);
  setMessage('Propiedad eliminada.', 'success');
}

async function loadProfile(user) {
  const snapshot = await getDoc(doc(db, 'agents', user.uid));
  const profile = snapshot.exists() ? snapshot.data() : {};

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
  if (state.unsubscribeProperties) state.unsubscribeProperties();

  state.unsubscribeProperties = onSnapshot(query(collection(db, 'properties'), where('agentId', '==', user.uid)), (snapshot) => {
    const properties = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
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
  const authBox = document.getElementById('agentAuthBox');

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    authBox.innerHTML = authMarkup(user);
    updateLayoutForAuth(user);

    if (!user) {
      setMessage('Inicia sesión para administrar tu perfil y propiedades.', 'info');
      return;
    }

    await loadProfile(user);
    listenOwnProperties(user);
    setMessage('Sesión activa. Solo puedes editar tus propios datos.', 'success');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));
  });

  authBox.addEventListener('click', async (event) => {
    if (event.target.id !== 'googleLoginBtn') return;
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
      setMessage('No fue posible iniciar sesión con Google.', 'error');
    }
  });
}

function init() {
  document.getElementById('agentProfileForm')?.addEventListener('submit', saveProfile);
  document.getElementById('propertyForm')?.addEventListener('submit', saveProperty);
  document.getElementById('propertyFormReset')?.addEventListener('click', resetPropertyForm);
  initPropertyLocationMap();
  bindAuthControls();
  bindImageUrlInput();
  bindImagePreviewActions();
  renderImagePreview();
}

window.addEventListener('DOMContentLoaded', init);
