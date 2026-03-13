const NICARAGUA_CENTER = [12.8654, -85.2072];
const DEFAULT_ZOOM = 7;
const SELECTED_ZOOM = 15;
const ALLOWED_ADMIN_EMAIL = 'norvingarcia220@gmail.com';

const state = {
  user: null,
  agents: [],
  properties: [],
  reviews: [],
  unsubscribeProperties: null,
  authCheckId: 0,
  uiReady: false
};

const form = document.getElementById('propertyForm');
const list = document.getElementById('propertyList');
const agentList = document.getElementById('agentList');
const reviewsSummary = document.getElementById('reviewsSummary');
const adminPanel = document.getElementById('adminPanel');
const accessDeniedPanel = document.getElementById('accessDeniedPanel');

const fields = {
  id: document.getElementById('propertyId'),
  title: document.getElementById('title'),
  price: document.getElementById('price'),
  city: document.getElementById('city'),
  address: document.getElementById('address'),
  bedrooms: document.getElementById('bedrooms'),
  bathrooms: document.getElementById('bathrooms'),
  size: document.getElementById('size'),
  type: document.getElementById('propertyType'),
  description: document.getElementById('description'),
  latitude: document.getElementById('latitude'),
  longitude: document.getElementById('longitude'),
  agentId: document.getElementById('propertyAgent')
};

const imagesContainer = document.getElementById('imagesContainer');
const addImageBtn = document.getElementById('addImageBtn');

const preview = {
  image: document.getElementById('previewImage'),
  type: document.getElementById('previewType'),
  title: document.getElementById('previewTitle'),
  location: document.getElementById('previewLocation'),
  price: document.getElementById('previewPrice'),
  specs: document.getElementById('previewSpecs'),
  description: document.getElementById('previewDescription')
};

let locationMap;
let locationMarker;

function getFirebaseOrNotify() {
  const client = window.inmoFirebase;
  if (!client?.enabled || !client.auth || !client.db) {
    console.error('Firebase no está disponible en este entorno.');
    return null;
  }
  return client;
}

function sanitizePrice(value) {
  if (typeof value === 'number') return value;
  const clean = String(value || '').replace(/[^\d.-]/g, '');
  return Number(clean) || 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatStatus(value) {
  const normalized = String(value || 'available').toLowerCase();
  if (normalized === 'sold') return 'Sold';
  if (normalized === 'reserved') return 'Reserved';
  return 'Available';
}

function getCoordinates(property = {}) {
  const latitude = Number(property.latitude ?? property.lat);
  const longitude = Number(property.longitude ?? property.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

function setCoordinates(latitude, longitude, shouldCenter = false) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

  fields.latitude.value = formatCoordinate(latitude);
  fields.longitude.value = formatCoordinate(longitude);

  if (!locationMap || typeof L === 'undefined') return;

  if (!locationMarker) {
    locationMarker = L.marker([latitude, longitude], { draggable: true }).addTo(locationMap);
    locationMarker.on('dragend', (event) => {
      const point = event.target.getLatLng();
      setCoordinates(point.lat, point.lng);
    });
  } else {
    locationMarker.setLatLng([latitude, longitude]);
  }

  if (shouldCenter) {
    locationMap.setView([latitude, longitude], SELECTED_ZOOM);
  }
}

function initAdminMap() {
  if (locationMap || typeof L === 'undefined') return;

  const mapContainer = document.getElementById('admin-map');
  if (!mapContainer) return;

  locationMap = L.map(mapContainer, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView(NICARAGUA_CENTER, DEFAULT_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(locationMap);

  locationMap.on('click', (event) => {
    setCoordinates(event.latlng.lat, event.latlng.lng);
  });

  setTimeout(() => locationMap.invalidateSize(), 300);
}

function refreshMapSize() {
  if (!locationMap) return;
  setTimeout(() => locationMap.invalidateSize(), 300);
}

function getAgentNameById(agentId) {
  if (!agentId) return 'Sin agente';
  const found = state.agents.find((agent) => agent.id === agentId);
  return found?.name || 'Agente desconocido';
}

function renderAgentOptions() {
  if (!fields.agentId) return;

  const options = ['<option value="">Seleccionar agente</option>']
    .concat(state.agents.map((agent) => `<option value="${agent.id}">${agent.name}</option>`));
  fields.agentId.innerHTML = options.join('');
}

function renderAgentsTable() {
  if (!agentList) return;

  agentList.innerHTML = '';
  if (!state.agents.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="3">No agents found in Firestore.</td>';
    agentList.appendChild(row);
    return;
  }

  state.agents
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .forEach((agent) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${agent.name || 'Sin nombre'}</td>
        <td>${agent.email || 'Sin correo'}</td>
        <td>${String(agent.role || 'agent')}</td>
      `;
      agentList.appendChild(row);
    });
}

function renderReviewsSummary() {
  if (!reviewsSummary) return;
  const count = state.reviews.length;
  reviewsSummary.textContent = count
    ? `Reseñas cargadas desde Firestore: ${count}`
    : 'No reviews found in Firestore.';
}

async function loadAgents() {
  const client = getFirebaseOrNotify();
  if (!client) return;

  const snapshot = await client.db.collection('agents').get();
  state.agents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  renderAgentOptions();
  renderAgentsTable();
}

async function loadReviews() {
  const client = getFirebaseOrNotify();
  if (!client) return;

  const snapshot = await client.db.collection('reviews').get();
  state.reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  renderReviewsSummary();
}

function getImagesFromProperty(property) {
  if (Array.isArray(property.images) && property.images.length) return property.images;
  return property.image ? [property.image] : [];
}

function getImageUrlsFromForm() {
  return Array.from(imagesContainer.querySelectorAll('.image-url-input'))
    .map((input) => String(input.value || '').trim())
    .filter(Boolean);
}

function refreshImageFieldLabels() {
  const rows = imagesContainer.querySelectorAll('.image-input-row');
  rows.forEach((row, index) => {
    const label = row.querySelector('label');
    if (label) label.textContent = `Imagen ${index + 1}`;

    const removeButton = row.querySelector('.remove-image-btn');
    if (removeButton) removeButton.disabled = rows.length === 1;
  });
}

function addImageField(value = '') {
  const row = document.createElement('div');
  row.className = 'image-input-row';

  row.innerHTML = `
    <label>Imagen</label>
    <div class="image-input-controls">
      <input type="url" class="image-url-input" placeholder="https://..." required>
      <button type="button" class="ghost remove-image-btn">Quitar</button>
    </div>
  `;

  const input = row.querySelector('.image-url-input');
  const removeBtn = row.querySelector('.remove-image-btn');

  input.value = value;
  input.addEventListener('input', updatePreview);

  removeBtn.addEventListener('click', () => {
    if (imagesContainer.children.length === 1) return;
    row.remove();
    refreshImageFieldLabels();
    updatePreview();
  });

  imagesContainer.appendChild(row);
  refreshImageFieldLabels();
}

function resetImageFields(values = ['']) {
  imagesContainer.innerHTML = '';
  values.forEach((value) => addImageField(value));
}

function fillForm(property) {
  fields.id.value = property.id;
  fields.title.value = property.title || property.titulo || '';
  fields.type.value = property.type || property.tipo || 'Casa';
  fields.price.value = property.price || property.precio || '';
  fields.bedrooms.value = property.bedrooms || property.habitaciones || 0;
  fields.bathrooms.value = property.bathrooms || property.banos || 0;
  fields.size.value = property.area || 0;

  const locationValue = property.location || property.ubicacion || '';
  const [city = '', ...addressParts] = String(locationValue).split(',');
  fields.city.value = city.trim();
  fields.address.value = addressParts.join(',').trim();

  fields.description.value = property.description || property.descripcion || '';
  fields.agentId.value = property.agentId || '';

  const images = getImagesFromProperty(property);
  resetImageFields(images.length ? images : ['']);

  const coordinates = getCoordinates(property);
  if (coordinates) {
    setCoordinates(coordinates.latitude, coordinates.longitude, true);
  } else {
    fields.latitude.value = '';
    fields.longitude.value = '';
  }

  updatePreview();
}

function buildPropertyPayload(existing = {}) {
  const latitude = Number(fields.latitude.value || NaN);
  const longitude = Number(fields.longitude.value || NaN);
  const title = fields.title.value.trim();
  const price = sanitizePrice(fields.price.value);
  const location = `${fields.city.value.trim()}, ${fields.address.value.trim()}`;
  const description = fields.description.value.trim();
  const type = fields.type.value;
  const bedrooms = Number(fields.bedrooms.value || 0);
  const bathrooms = Number(fields.bathrooms.value || 0);
  const area = Number(fields.size.value || 0);
  const images = getImageUrlsFromForm();
  const selectedAgentId = fields.agentId.value;

  return {
    ...existing,
    title,
    titulo: title,
    price,
    precio: price,
    location,
    ubicacion: location,
    description,
    descripcion: description,
    type,
    tipo: type,
    bedrooms,
    habitaciones: bedrooms,
    bathrooms,
    banos: bathrooms,
    area,
    images,
    image: images[0] || existing.image || 'assets/placeholder.svg',
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    lat: Number.isFinite(latitude) ? latitude : null,
    lng: Number.isFinite(longitude) ? longitude : null,
    agentId: selectedAgentId,
    agentName: getAgentNameById(selectedAgentId),
    status: String(existing.status || 'available').toLowerCase(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
}

function updatePreview() {
  preview.type.textContent = fields.type.value || 'Tipo';
  preview.title.textContent = fields.title.value || 'Título de propiedad';
  preview.location.textContent = `${fields.city.value || 'Ciudad'} - ${fields.address.value || 'Dirección'}`;
  preview.price.textContent = formatCurrency(sanitizePrice(fields.price.value));
  preview.specs.textContent = `${fields.bedrooms.value || 0} hab • ${fields.bathrooms.value || 0} baños • ${fields.size.value || 0} m²`;
  preview.description.textContent = fields.description.value || 'Descripción de la propiedad...';
  preview.image.src = getImageUrlsFromForm()[0] || 'assets/placeholder.svg';
}

function clearFormState() {
  form.reset();
  fields.id.value = '';
  fields.latitude.value = '';
  fields.longitude.value = '';
  if (fields.agentId) fields.agentId.value = '';
  resetImageFields(['']);

  if (locationMap) locationMap.setView(NICARAGUA_CENTER, DEFAULT_ZOOM);
  if (locationMarker && locationMap) {
    locationMap.removeLayer(locationMarker);
    locationMarker = null;
  }

  updatePreview();
}

function renderList() {
  list.innerHTML = '';

  if (!state.properties.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = 'No properties found in Firestore.';
    row.appendChild(cell);
    list.appendChild(row);
    return;
  }

  state.properties
    .slice()
    .sort((a, b) => String(a.title || a.titulo || '').localeCompare(String(b.title || b.titulo || '')))
    .forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.title || item.titulo || ''}</td>
        <td>${item.agentName || getAgentNameById(item.agentId)}</td>
        <td>${formatCurrency(item.price || item.precio)}</td>
        <td>${formatStatus(item.status)}</td>
        <td class="action-cell">
          <button type="button" class="edit-btn" data-id="${item.id}">Edit</button>
          <button type="button" class="delete-btn" data-id="${item.id}">Delete</button>
        </td>
      `;

      row.querySelector('.edit-btn')?.addEventListener('click', () => fillForm(item));
      row.querySelector('.delete-btn')?.addEventListener('click', () => deleteProperty(item.id));
      list.appendChild(row);
    });
}

function listenAllProperties() {
  const client = getFirebaseOrNotify();
  if (!client) {
    finishAuthCheck();
    return;
  }

  if (state.unsubscribeProperties) state.unsubscribeProperties();

  state.unsubscribeProperties = client.db.collection('properties').onSnapshot((snapshot) => {
    state.properties = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderList();
  }, (error) => {
    console.error(error);
    console.error('No se pudieron cargar las propiedades.');
  });
}

async function deleteProperty(propertyId) {
  const client = getFirebaseOrNotify();
  if (!client || !propertyId) return;

  const confirmed = window.confirm('¿Seguro que deseas eliminar esta propiedad? Esta acción no se puede deshacer.');
  if (!confirmed) return;

  await client.db.collection('properties').doc(propertyId).delete();

  if (fields.id.value === propertyId) {
    clearFormState();
  }
}

async function savePropertyUpdate() {
  if (!form.reportValidity()) return;

  const client = getFirebaseOrNotify();
  if (!client) {
    finishAuthCheck();
    return;
  }

  const propertyId = String(fields.id.value || '').trim();
  if (!propertyId) {
    alert('Selecciona una propiedad desde la tabla para editarla.');
    return;
  }

  const ref = client.db.collection('properties').doc(propertyId);
  const current = await ref.get();

  if (!current.exists) {
    alert('No se encontró la propiedad para actualizar.');
    return;
  }

  const payload = buildPropertyPayload(current.data());
  await ref.set(payload, { merge: true });
  alert('Propiedad actualizada.');
}

function hasAllowedAdminEmail(user) {
  const userEmail = String(user?.email || '').trim().toLowerCase();
  return userEmail === ALLOWED_ADMIN_EMAIL;
}

function logAuthDebug(user) {
  const userEmail = String(user?.email || '').trim().toLowerCase();
  const adminAllowed = hasAllowedAdminEmail(user);

  console.log('[admin] user email:', userEmail || 'none');
  console.log('[admin] login state:', Boolean(user));
  console.log('[admin] admin verification:', adminAllowed);
}

function finishAuthCheck() {
  document.body.classList.remove('auth-checking');
}

function prepareAdminUI() {
  if (state.uiReady) return;
  resetImageFields(['']);
  bindActions();
  updatePreview();
  state.uiReady = true;
}

function showAdmin() {
  prepareAdminUI();
  accessDeniedPanel?.classList.add('hidden');
  adminPanel.classList.remove('hidden');
  finishAuthCheck();
  initAdminMap();
  refreshMapSize();
}

function showAccessDenied() {
  hideAdmin();
  accessDeniedPanel?.classList.remove('hidden');

  const deniedText = accessDeniedPanel?.querySelector('p');
  if (deniedText) {
    deniedText.textContent = 'Access denied – Admins only';
  }

  finishAuthCheck();
}

function hideAdmin() {
  adminPanel.classList.add('hidden');
  accessDeniedPanel?.classList.add('hidden');

  if (state.unsubscribeProperties) {
    state.unsubscribeProperties();
    state.unsubscribeProperties = null;
  }

  state.properties = [];
  state.agents = [];
  state.reviews = [];
  renderList();
  renderAgentsTable();
  renderReviewsSummary();
}

function redirectTo(path) {
  finishAuthCheck();
  window.location.replace(path);
}

function bindActions() {
  addImageBtn.addEventListener('click', () => addImageField(''));
  form.addEventListener('input', updatePreview);

  document.getElementById('addBtn')?.addEventListener('click', () => {
    alert('Desde este panel solo se editan propiedades existentes.');
  });

  document.getElementById('updateBtn')?.addEventListener('click', savePropertyUpdate);
  document.getElementById('clearBtn')?.addEventListener('click', () => clearFormState());


  document.getElementById('goToLoginBtn')?.addEventListener('click', () => {
    redirectTo('admin-login.html');
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    const client = getFirebaseOrNotify();
    if (!client) return;
    await client.auth.signOut();
  });

  window.addEventListener('resize', refreshMapSize);
}

function init() {
  const client = getFirebaseOrNotify();
  if (!client) {
    finishAuthCheck();
    return;
  }

  client.auth.onAuthStateChanged(async (user) => {
    const authCheckId = ++state.authCheckId;
    state.user = user;
    logAuthDebug(user);

    if (!user) {
      hideAdmin();
      redirectTo('admin-login.html');
      return;
    }

    try {
      const adminAllowed = hasAllowedAdminEmail(user);
      if (authCheckId !== state.authCheckId) return;

      if (!adminAllowed) {
        showAccessDenied();
        return;
      }

      showAdmin();
      await Promise.all([loadAgents(), loadReviews()]);
      if (authCheckId !== state.authCheckId) return;
      listenAllProperties();
      clearFormState();
    } catch (error) {
      if (authCheckId !== state.authCheckId) return;
      console.error(error);
      hideAdmin();
      redirectTo('admin-login.html?error=auth-failed');
    }
  });
}

window.addEventListener('DOMContentLoaded', init);
