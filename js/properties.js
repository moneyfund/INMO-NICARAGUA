let allProperties = [];
const imageUtils = window.inmoImageUtils || {
  PLACEHOLDER: 'assets/placeholder.svg',
  normalizeImageList: (values = []) => Array.from(new Set((Array.isArray(values) ? values : [values]).map((item) => String(item || '').trim()).filter(Boolean))),
  getPropertyImages: (property = {}) => {
    const imageList = Array.isArray(property.images) ? property.images : [];
    if (imageList.length) return imageList;
    if (property.coverImage) return [property.coverImage];
    return [property.image, property.imagen, ...(Array.isArray(property.imagenes) ? property.imagenes : [])].filter(Boolean);
  },
  getCoverImage: (property = {}) => property.coverImage || property.image || property.imagen || 'assets/placeholder.svg'
};

const PROPERTY_IMAGE_PLACEHOLDER = 'assets/placeholder.svg';
const AGENT_IMAGE_PLACEHOLDER = 'assets/placeholder.svg';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCVL7tpUkyQWz_aVr9wFi2hrCBum2pLnPs',
  authDomain: 'inmo-nicaragua.firebaseapp.com',
  projectId: 'inmo-nicaragua',
  storageBucket: 'inmo-nicaragua.firebasestorage.app',
  messagingSenderId: '735319266898',
  appId: '1:735319266898:web:124c3b886d0eb32a25b18b',
  measurementId: 'G-DXTBSYNR95'
};


const FACEBOOK_IMAGE_DOMAINS = ['facebook.com', 'fbcdn.net'];
const SWIPE_THRESHOLD = 45;
let modularFirestorePromise;

function getFirestoreDb() {
  const firebaseClient = window.inmoFirebase;
  return firebaseClient?.enabled && firebaseClient.db ? firebaseClient.db : null;
}

async function getModularFirestore() {
  if (!modularFirestorePromise) {
    modularFirestorePromise = (async () => {
      const [{ initializeApp, getApps, getApp }, {
        getFirestore,
        collection,
        getDocs,
        doc,
        getDoc,
        query,
        where,
        addDoc,
        deleteDoc,
        serverTimestamp
      }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      ]);

      const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
      const db = getFirestore(app);

      return {
        collection,
        getDocs,
        doc,
        getDoc,
        query,
        where,
        addDoc,
        deleteDoc,
        serverTimestamp,
        db
      };
    })();
  }

  return modularFirestorePromise;
}


const propertyUtils = window.inmoPropertyUtils || {};
const normalizePropertyType = (value = '') => propertyUtils.normalizePropertyType ? propertyUtils.normalizePropertyType(value) : String(value || '').trim().toLowerCase();
const getPropertyTypeLabel = (value = '') => propertyUtils.getPropertyTypeLabel ? propertyUtils.getPropertyTypeLabel(value) : '';
const normalizePropertyOperation = (value = '') => propertyUtils.normalizeOperation ? propertyUtils.normalizeOperation(value) : String(value || '').trim().toLowerCase();
const formatDualPrice = (usd) => propertyUtils.formatDualPrice ? propertyUtils.formatDualPrice(usd) : `$${Number(usd || 0).toLocaleString()} USD`;
const getPriceUsd = (property = {}) => propertyUtils.getPriceUsd ? propertyUtils.getPriceUsd(property) : Number(property.price ?? property.precio ?? 0);
const getAreaDisplay = (property = {}) => propertyUtils.getAreaDisplay ? propertyUtils.getAreaDisplay(property) : `${property.area || 0} m²`;
const getPricePerAreaUsd = (property = {}) => propertyUtils.getPricePerAreaUsd ? propertyUtils.getPricePerAreaUsd(property) : NaN;
const formatPricePerArea = (value, unit) => propertyUtils.formatPricePerArea ? propertyUtils.formatPricePerArea(value, unit) : '';
function formatPropertyOperation(value = '') {
  const normalized = normalizePropertyOperation(value);
  const labels = {
    venta: 'Venta',
    alquiler: 'Alquiler'
  };
  return labels[normalized] || '';
}

function isRentalOperation(value = '') {
  return normalizePropertyOperation(value) === 'alquiler';
}

function getMapMarkerPriceLabel(property = {}) {
  const price = getPriceUsd(property);
  if (!Number.isFinite(price) || price <= 0) return 'Consultar';
  const basePrice = `$${Math.round(price).toLocaleString('en-US')}`;
  return isRentalOperation(property.tipoOperacion || property.operacion || property.operation) ? `${basePrice}/mes` : basePrice;
}

function getPropertyDetailUrl(property = {}) {
  return `propiedad.html?id=${encodeURIComponent(String(property.id ?? ''))}`;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function featureIcon(iconName = '') {
  const icons = {
    bedrooms: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11V7.6A1.6 1.6 0 0 1 5.6 6h3.8A1.6 1.6 0 0 1 11 7.6V11h2V9.6A1.6 1.6 0 0 1 14.6 8h3.8A1.6 1.6 0 0 1 20 9.6V18h-2v-2H6v2H4v-7Zm2 3h12v-1H6v1Z"/></svg>',
    bathrooms: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v3H8V3Zm9 5v3a5 5 0 0 1-4 4.9V19h2v2H9v-2h2v-3.1A5 5 0 0 1 7 11V8h10Zm-2 3V10H9v1a3 3 0 0 0 6 0Z"/></svg>',
    parking: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h8a4 4 0 1 1 0 8H9v6H6V5Zm3 5h5a1 1 0 1 0 0-2H9v2Z"/></svg>',
    area: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 6 0v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z"/></svg>',
    location: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12Zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/></svg>',
    type: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z"/></svg>'
  };
  return icons[iconName] || '';
}

function normalizeProperty(property = {}, id = '') {
  const title = property.title || property.titulo || '';
  const price = getPriceUsd(property);
  const city = property.city || property.location || property.ubicacion || '';
  const image = imageUtils.getCoverImage(property);
  const bedrooms = Number(property.bedrooms ?? property.habitaciones ?? 0);
  const bathrooms = Number(property.bathrooms ?? property.banos ?? 0);
  const normalizedAreaValue = propertyUtils.getAreaValue ? propertyUtils.getAreaValue(property) : Number(property.area ?? 0);
  const area = Number.isFinite(normalizedAreaValue) ? normalizedAreaValue : (property.area || '');
  const type = normalizePropertyType(property.type || property.tipo || '');
  const operation = normalizePropertyOperation(property.tipoOperacion || property.operation || property.operacion || '');
  const description = property.description || property.descripcion || '';

  return {
    ...property,
    id,
    title,
    titulo: title,
    price,
    precio: price,
    city,
    location: city,
    ubicacion: city,
    image,
    bedrooms,
    habitaciones: bedrooms,
    bathrooms,
    banos: bathrooms,
    area,
    type,
    tipo: type,
    priceUsd: Number.isFinite(price) ? price : null,
    typeLabel: getPropertyTypeLabel(type),
    operation,
    operacion: operation,
    tipoOperacion: operation,
    operationLabel: formatPropertyOperation(operation),
    areaValue: Number.isFinite(normalizedAreaValue) ? normalizedAreaValue : null,
    areaUnit: propertyUtils.normalizeAreaUnit ? propertyUtils.normalizeAreaUnit(property.areaUnit || '') : (property.areaUnit || ''),
    pricePerAreaUsd: Number.isFinite(getPricePerAreaUsd(property)) ? getPricePerAreaUsd(property) : null,
    description,
    descripcion: description
  };
}

function isFacebookImageUrl(urlString) {
  try {
    const hostname = new URL(urlString).hostname.toLowerCase();
    return FACEBOOK_IMAGE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch (error) {
    return false;
  }
}

function normalizePropertyImageUrl(urlString) {
  const normalized = String(urlString || '').trim();
  if (!normalized) return '';

  if (isFacebookImageUrl(normalized)) {
    console.warn('Las imágenes de Facebook no pueden ser usadas directamente. Use enlaces de imágenes directos como JPG o PNG.');
    return '';
  }

  try {
    const parsed = new URL(normalized, window.location.origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn(`Imagen descartada por protocolo no compatible: ${normalized}`);
      return '';
    }
  } catch (error) {
    console.warn(`Imagen descartada por URL inválida: ${normalized}`);
    return '';
  }

  return normalized;
}

async function loadPropertiesFromFirestore() {
  const { db, collection, getDocs } = await getModularFirestore();
  const snapshot = await getDocs(collection(db, 'properties'));
  const properties = [];

  snapshot.forEach((doc) => {
    const property = doc.data();
    const propertyId = doc.id;
    properties.push(normalizeProperty(property, propertyId));
  });

  console.log('Propiedades cargadas desde Firestore:', properties);
  return properties;
}

async function loadProperties() {
  allProperties = await loadPropertiesFromFirestore();
  return allProperties;
}

function subscribeToProperties(onUpdate) {
  const db = getFirestoreDb();
  if (!db) return () => {};

  return db.collection('properties').onSnapshot((snapshot) => {
    const properties = snapshot.docs.map((doc) => normalizeProperty(doc.data(), doc.id));
    allProperties = properties;
    onUpdate(properties);
  }, (error) => {
    console.error('Error escuchando propiedades de Firestore:', error);
  });
}

async function loadAgents() {
  const { db, collection, getDocs } = await getModularFirestore();
  const snapshot = await getDocs(collection(db, 'agents'));
  const agents = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  console.log('Agentes cargados desde Firestore:', agents);
  return agents;
}

function buildGalleryControlsMarkup(images = []) {
  if (images.length <= 1) return '';
  return `
    <button class="gallery-nav gallery-prev" type="button" aria-label="Imagen anterior">&#10094;</button>
    <button class="gallery-nav gallery-next" type="button" aria-label="Imagen siguiente">&#10095;</button>
    <p class="gallery-counter" aria-live="polite"></p>
  `;
}

function propertyCardTemplate(property) {
  const featuredClass = property.featured ? ' is-featured' : '';
  const status = (property.status || 'disponible').toLowerCase();
  const galleryImages = getPropertyImages(property);
  const imageSrc = galleryImages[0] || getPrimaryPropertyImage(property);
  const imageAlt = property.title || property.titulo || 'Imagen de la propiedad';
  const detailUrl = getPropertyDetailUrl(property);
  const locationLabel = property.city || property.ubicacion || 'Ubicación no disponible';
  const parkingCount = Number(property.parking ?? property.garaje ?? property.garages ?? 0);

  return `
    <article class="property-card${featuredClass}">
      <section class="property-gallery" data-gallery-images='${JSON.stringify(galleryImages)}' data-gallery-label="${imageAlt}">
        <img class="property-gallery-main-image" src="${imageSrc}" alt="${imageAlt}" loading="lazy" onerror="this.onerror=null;this.src='${PROPERTY_IMAGE_PLACEHOLDER}'">
        ${buildGalleryControlsMarkup(galleryImages)}
      </section>
      <div class="property-card-content">
        <p class="badge">${property.typeLabel || getPropertyTypeLabel(property.tipo) || 'Propiedad'} en ${(property.operationLabel || formatPropertyOperation(property.operacion) || 'Venta').toLowerCase()}</p>
        <h3>${property.title || property.titulo}</h3>
        <p>${locationLabel}</p>
        <p class="price">${formatDualPrice(getPriceUsd(property))}</p>
        ${status === 'sold' ? '<p class="property-status-tag">VENDIDA</p>' : ''}
        <div class="property-meta property-meta-icons">
          <span>${featureIcon('bedrooms')} ${(property.bedrooms ?? property.habitaciones) || 0} hab.</span>
          <span>${featureIcon('bathrooms')} ${(property.bathrooms ?? property.banos) || 0} baños</span>
          <span>${featureIcon('parking')} ${parkingCount > 0 ? `${parkingCount} parqueo` : 'Sin parqueo'}</span>
          <span>${featureIcon('area')} ${getAreaDisplay(property)}</span>
          <span>${featureIcon('location')} ${locationLabel}</span>
          <span>${featureIcon('type')} ${property.typeLabel || getPropertyTypeLabel(property.tipo) || 'Propiedad'}</span>
        </div>
        <p>${formatPricePerArea(getPricePerAreaUsd(property), property.areaUnit)}</p>
        <p><a class="btn-primary-property" href="${detailUrl}">Ver detalle</a></p>
      </div>
    </article>
  `;
}

function getPropertyImages(property) {
  const normalizedImages = imageUtils.getPropertyImages(property)
    .map(normalizePropertyImageUrl)
    .filter(Boolean);

  return normalizedImages;
}

function getPrimaryPropertyImage(property) {
  const coverImage = normalizePropertyImageUrl(imageUtils.getCoverImage(property));
  if (coverImage) return coverImage;

  const [primaryImage] = getPropertyImages(property);
  return primaryImage || PROPERTY_IMAGE_PLACEHOLDER;
}

function renderFeatured(properties) {
  const featuredGrid = document.getElementById('featuredGrid');
  if (!featuredGrid) return;
  featuredGrid.innerHTML = properties.slice(0, 3).map(propertyCardTemplate).join('');
  initPropertyGallery(featuredGrid);
  applyCardRevealAnimation(featuredGrid);
}

function renderCategory(properties, gridId, filterFn) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const filtered = properties.filter(filterFn).slice(0, 3);
  grid.innerHTML = filtered.map(propertyCardTemplate).join('');
  initPropertyGallery(grid);
  applyCardRevealAnimation(grid);
}

function renderTerrenos(properties) {
  renderCategory(properties, 'terrenosGrid', (property) => normalizePropertyType(property.tipo) === 'land');
}

function renderAlquileres(properties) {
  const grid = document.getElementById('alquileresGrid');
  if (!grid) return;

  const rentals = properties.filter((property) => normalizePropertyOperation(property.operacion) === 'alquiler');
  grid.innerHTML = rentals.slice(0, 3).map(propertyCardTemplate).join('');
  initPropertyGallery(grid);
  applyCardRevealAnimation(grid);
}

function renderPropertyList(properties) {
  const grid = document.getElementById('propertiesGrid');
  const emptyState = document.getElementById('emptyState');
  if (!grid) return;

  grid.innerHTML = properties.map(propertyCardTemplate).join('');
  initPropertyGallery(grid);
  if (emptyState) emptyState.classList.toggle('hidden', properties.length !== 0);
  applyCardRevealAnimation(grid);
}

function applyCardRevealAnimation(container) {
  const cards = container.querySelectorAll('.property-card');
  if (!cards.length) return;

  cards.forEach((card) => card.classList.add('reveal-on-scroll'));

  const observer = new IntersectionObserver((entries, observerRef) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observerRef.unobserve(entry.target);
    });
  }, {
    threshold: 0.2,
    rootMargin: '0px 0px -30px 0px'
  });

  cards.forEach((card) => observer.observe(card));
}

function getInitialFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    ubicacion: params.get('ubicacion') || '',
    tipo: normalizePropertyType(params.get('tipo') || ''),
    operacion: normalizePropertyOperation(params.get('operacion') || params.get('tipoOperacion') || ''),
    agent: params.get('agent') || ''
  };
}

function filterByAgent(properties, agentId) {
  if (!agentId) return properties;
  return properties.filter((property) => property.agentId === agentId);
}

function renderAgentFilterBanner(agentId, agents = []) {
  const banner = document.getElementById('agentFilterBanner');
  if (!banner) return;

  if (!agentId) {
    banner.classList.add('hidden');
    banner.textContent = '';
    return;
  }

  const selectedAgent = agents.find((agent) => agent.id === agentId);
  const agentName = selectedAgent?.name || 'agente seleccionado';
  banner.textContent = `Propiedades de ${agentName}`;
  banner.classList.remove('hidden');
}

function applyFilters(properties) {
  const locationInput = document.getElementById('filterLocation')?.value.trim().toLowerCase() || '';
  const typeInput = normalizePropertyType(document.getElementById('filterType')?.value || '');
  const operationInput = normalizePropertyOperation(document.getElementById('filterOperation')?.value || '');
  const budgetInput = Number(document.getElementById('filterBudget')?.value || 0);

  return properties.filter((property) => {
    const matchesLocation = !locationInput || String(property.ubicacion || '').toLowerCase().includes(locationInput);
    const matchesType = !typeInput || normalizePropertyType(property.tipo) === typeInput;
    const matchesOperation = !operationInput || normalizePropertyOperation(property.tipoOperacion || property.operacion || property.operation) === operationInput;
    const matchesBudget = !budgetInput || Number(getPriceUsd(property) || 0) <= budgetInput;
    return matchesLocation && matchesType && matchesOperation && matchesBudget;
  });
}

function getPropertyCoordinates(property) {
  const latitude = Number(property.latitude ?? property.lat);
  const longitude = Number(property.longitude ?? property.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return [latitude, longitude];
}

function hasValidCoordinates(property) {
  return Boolean(getPropertyCoordinates(property));
}

function renderPropertyDetailMap(property) {
  const mapElement = document.getElementById('propertyMap');
  if (!mapElement || typeof L === 'undefined' || !hasValidCoordinates(property)) return;

  const coordinates = getPropertyCoordinates(property);
  if (!coordinates) return;

  const map = L.map(mapElement).setView(coordinates, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.marker(coordinates).addTo(map)
    .bindPopup(`<strong>${property.titulo}</strong><br>${property.ubicacion}`)
    .openPopup();
}

async function loadPropertyDetailFromFirestore(propertyId) {
  const { db, doc, getDoc } = await getModularFirestore();
  const propertyRef = doc(db, 'properties', propertyId);
  const propertySnap = await getDoc(propertyRef);

  if (!propertySnap.exists()) {
    console.error('Property not found:', propertyId);
    return null;
  }

  return normalizeProperty(propertySnap.data(), propertySnap.id);
}

async function loadAgentById(agentId) {
  if (!agentId) return null;

  const { db, doc, getDoc } = await getModularFirestore();
  const agentRef = doc(db, 'agents', agentId);
  const agentSnap = await getDoc(agentRef);

  if (!agentSnap.exists()) return null;
  return { id: agentSnap.id, ...agentSnap.data() };
}

function getCurrentUser() {
  if (window.inmoAuthState?.currentUser) return window.inmoAuthState.currentUser;
  if (window.inmoFirebase?.currentUser) return window.inmoFirebase.currentUser;
  return null;
}

function buildAgentProfileUrl(agentId) {
  if (!agentId) return 'agentes.html';
  return `agente.html?id=${encodeURIComponent(agentId)}`;
}

async function findFavorite(propertyId, userId) {
  if (!propertyId || !userId) return null;

  const { db, collection, query, where, getDocs } = await getModularFirestore();
  const favoritesRef = collection(db, 'favorites');
  const favoriteQuery = query(
    favoritesRef,
    where('userId', '==', userId),
    where('propertyId', '==', propertyId)
  );
  const favoriteSnapshot = await getDocs(favoriteQuery);
  const favoriteDoc = favoriteSnapshot.docs[0];
  return favoriteDoc ? { id: favoriteDoc.id, ...favoriteDoc.data() } : null;
}

async function createFavorite(propertyId, userId) {
  const { db, collection, addDoc, serverTimestamp } = await getModularFirestore();
  const favoritesRef = collection(db, 'favorites');
  const created = await addDoc(favoritesRef, {
    userId,
    propertyId,
    createdAt: serverTimestamp()
  });
  return created.id;
}

async function removeFavorite(favoriteId) {
  if (!favoriteId) return;
  const { db, doc, deleteDoc } = await getModularFirestore();
  await deleteDoc(doc(db, 'favorites', favoriteId));
}

async function initFavoriteButton(propertyId) {
  const favoriteButton = document.getElementById('favoritePropertyButton');
  if (!favoriteButton) return;

  let favoriteRecord = null;
  let pending = false;

  const updateFavoriteUi = (isFavorite) => {
    favoriteButton.textContent = isFavorite ? '❤️ Guardada' : '🤍 Guardar';
    favoriteButton.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
  };

  const syncFavoriteState = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser?.uid) {
      favoriteRecord = null;
      favoriteButton.disabled = true;
      favoriteButton.textContent = '🤍 Inicia sesión para guardar';
      favoriteButton.setAttribute('aria-pressed', 'false');
      return;
    }

    favoriteButton.disabled = false;
    favoriteRecord = await findFavorite(propertyId, currentUser.uid);
    updateFavoriteUi(Boolean(favoriteRecord));
  };

  favoriteButton.addEventListener('click', async () => {
    const currentUser = getCurrentUser();
    if (!currentUser?.uid || pending) return;

    pending = true;
    favoriteButton.disabled = true;

    try {
      if (favoriteRecord?.id) {
        await removeFavorite(favoriteRecord.id);
        favoriteRecord = null;
        updateFavoriteUi(false);
      } else {
        const favoriteId = await createFavorite(propertyId, currentUser.uid);
        favoriteRecord = { id: favoriteId, userId: currentUser.uid, propertyId };
        updateFavoriteUi(true);
      }
    } catch (error) {
      console.error('No fue posible actualizar favorito:', error);
    } finally {
      pending = false;
      favoriteButton.disabled = false;
    }
  });

  document.addEventListener('inmo:auth-state-changed', () => {
    syncFavoriteState().catch((error) => {
      console.error('No fue posible sincronizar favoritos:', error);
    });
  });

  await syncFavoriteState();
}

async function renderPropertyDetail() {
  const detailContainer = document.getElementById('propertyDetail');
  if (!detailContainer) return;

  const params = new URLSearchParams(window.location.search);
  const propertyId = params.get('id');
  console.log('Property ID from URL:', propertyId);

  if (!propertyId || !propertyId.trim()) {
    detailContainer.innerHTML = '<p>Property not found. <a href="propiedades.html" class="text-link">Ver propiedades</a></p>';
    return;
  }

  const normalizedPropertyId = propertyId.trim();
  const property = await loadPropertyDetailFromFirestore(normalizedPropertyId);

  if (!property) {
    detailContainer.innerHTML = '<p>Property not found. <a href="propiedades.html" class="text-link">Ver propiedades</a></p>';
    return;
  }

  const [agent, galleryImages] = await Promise.all([
    loadAgentById(property.agentId).catch(() => null),
    Promise.resolve(getPropertyImages(property))
  ]);
  const publishedByName = agent?.name || property.agentName || '';
  const hasAgentLink = Boolean(agent?.id || property.agentId);
  const agentProfileUrl = buildAgentProfileUrl(agent?.id || property.agentId);
  const status = String(property.status || 'available').toLowerCase();
  const detailParkingCount = Number(property.parking ?? property.garaje ?? property.garages ?? 0);

  const galleryMarkup = buildGalleryControlsMarkup(galleryImages);

  detailContainer.innerHTML = `
    <div class="detail-grid">
      <section class="detail-gallery" data-gallery-images='${JSON.stringify(galleryImages)}' data-gallery-label="${property.titulo || 'Imagen de la propiedad'}">
        <img class="detail-gallery-main-image" src="${galleryImages[0] || getPrimaryPropertyImage(property)}" alt="${property.titulo || 'Imagen de la propiedad'}" loading="lazy" onerror="this.onerror=null;this.src='${PROPERTY_IMAGE_PLACEHOLDER}'">
        ${galleryMarkup}
      </section>
      <div>
        <p class="badge">${property.typeLabel || getPropertyTypeLabel(property.tipo) || 'Propiedad'} en ${(property.operationLabel || formatPropertyOperation(property.operacion) || 'Venta').toLowerCase()}</p>
        <h1>${property.titulo}</h1>
        <p>${property.ubicacion}</p>
        <p><strong>${property.typeLabel || getPropertyTypeLabel(property.tipo) || 'Propiedad'} en ${(property.operationLabel || formatPropertyOperation(property.operacion) || 'venta').toLowerCase()}</strong></p>
        <p class="price">${formatDualPrice(getPriceUsd(property))}</p>
        <div class="property-main-actions">
          <div id="propertyLikeMount" class="property-like-mount" aria-live="polite"></div>
          <button id="favoritePropertyButton" class="favorite-property-button" type="button" aria-label="Guardar propiedad en favoritos" aria-pressed="false">🤍 Guardar</button>
        </div>
        <p><strong>Área:</strong> ${getAreaDisplay(property)}</p>
        <p><strong>Precio por área:</strong> ${formatPricePerArea(getPricePerAreaUsd(property), property.areaUnit)}</p>
        ${status === 'sold' ? '<p class="property-status-tag">VENDIDA</p>' : ''}
        <p>${property.descripcion}</p>
        <ul class="checklist property-feature-list">
          <li>${featureIcon('bedrooms')} ${(property.habitaciones ?? property.bedrooms) || 0} habitaciones</li>
          <li>${featureIcon('bathrooms')} ${(property.banos ?? property.bathrooms) || 0} baños</li>
          <li>${featureIcon('parking')} ${detailParkingCount > 0 ? `${detailParkingCount} parqueo(s)` : 'Sin parqueo'}</li>
          <li>${featureIcon('area')} ${getAreaDisplay(property)}</li>
          <li>${featureIcon('location')} ${property.ubicacion || property.city || 'Ubicación no disponible'}</li>
        </ul>
        ${publishedByName ? `<p><strong>Publicado por</strong><br>${publishedByName}</p>` : ''}
        ${hasAgentLink ? `<a class="button-outline" href="${agentProfileUrl}">Para más información aquí</a>` : ''}
      </div>
    </div>
    <section class="detail-map-section">
      <h2>Ubicación de la propiedad</h2>
      <div id="propertyMap" class="property-map"></div>
    </section>
    <section class="property-reviews-section" id="propertyReviews">
      <section class="pi-wrap">
        <header class="pi-header">
          <div>
            <p class="pi-eyebrow">Interacciones</p>
            <h2>Comentarios y reseñas</h2>
          </div>
        </header>
        <div class="pi-grid pi-grid-two">
          <article class="pi-card">
            <div class="pi-card-head">
              <h3>Comentarios</h3>
              <p>Escribe un comentario para esta propiedad.</p>
            </div>
            <p class="pi-empty">Cargando comentarios...</p>
          </article>
          <article class="pi-card">
            <div class="pi-card-head">
              <h3>Reseñas</h3>
              <p>Califica y comparte tu opinión sobre esta propiedad.</p>
            </div>
            <p class="pi-empty">Cargando reseñas...</p>
          </article>
        </div>
      </section>
    </section>
  `;

  initPropertyGallery(detailContainer);
  renderPropertyDetailMap(property);
  await initFavoriteButton(normalizedPropertyId);
  window.dispatchEvent(new CustomEvent('propertyDetailReady', {
    detail: {
      property,
      propertyId: normalizedPropertyId
    }
  }));
}

function initPropertyGallery(scope = document) {
  const galleries = scope.querySelectorAll('.detail-gallery, .property-gallery');
  if (!galleries.length) return;

  galleries.forEach((gallery) => {
    if (gallery.dataset.galleryReady === 'true') return;

    const mainImage = gallery.querySelector('.detail-gallery-main-image, .property-gallery-main-image');
    if (!mainImage) return;

    const images = (() => {
      try {
        const parsed = JSON.parse(gallery.dataset.galleryImages || '[]');
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch (error) {
        return [];
      }
    })();

    if (!images.length) return;

    const galleryCounter = gallery.querySelector('.gallery-counter');
    const baseLabel = String(gallery.dataset.galleryLabel || mainImage.alt || 'Imagen de la propiedad').trim();
    let currentIndex = 0;
    let pointerStartX = 0;

    function updateImage(index) {
      currentIndex = (index + images.length) % images.length;
      mainImage.src = images[currentIndex] || PROPERTY_IMAGE_PLACEHOLDER;
      mainImage.alt = `${baseLabel} (${currentIndex + 1}/${images.length})`;

      if (galleryCounter) {
        galleryCounter.textContent = `${currentIndex + 1}/${images.length}`;
      }

    }

    gallery.querySelector('.gallery-prev')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      updateImage(currentIndex - 1);
    });
    gallery.querySelector('.gallery-next')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      updateImage(currentIndex + 1);
    });

    gallery.addEventListener('pointerdown', (event) => {
      pointerStartX = event.clientX;
    });

    gallery.addEventListener('pointerup', (event) => {
      const diffX = event.clientX - pointerStartX;
      if (Math.abs(diffX) < SWIPE_THRESHOLD) return;
      if (diffX < 0) {
        updateImage(currentIndex + 1);
        return;
      }
      updateImage(currentIndex - 1);
    });

    gallery.dataset.galleryReady = 'true';
    updateImage(0);
  });
}

function renderGlobalMap(properties) {
  const mapElement = document.getElementById('propertiesMap');
  if (!mapElement || typeof L === 'undefined') return;

  const geolocated = properties.filter(hasValidCoordinates);
  if (!geolocated.length) return;

  const map = L.map(mapElement).setView([12.8654, -85.2072], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const bounds = [];
  const pointerMedia = window.matchMedia('(hover: none), (pointer: coarse)');
  let activeMarker = null;
  let activePopup = null;

  const setMarkerActiveState = (marker, isActive) => {
    const markerElement = marker.getElement();
    if (!markerElement) return;
    markerElement.classList.toggle('is-active', isActive);
  };

  const buildPreviewMarkup = (property) => {
    const summary = String(property.description || property.descripcion || '').trim();
    const shortSummary = summary.length > 92 ? `${summary.slice(0, 89)}...` : summary;
    const locationLabel = property.city || property.ubicacion || 'Ubicación no disponible';
    const image = getPrimaryPropertyImage(property);
    const detailUrl = getPropertyDetailUrl(property);
    const safeTitle = escapeHtml(property.titulo || property.title || 'Propiedad');

    return `
      <a class="map-preview-card" href="${detailUrl}" aria-label="Abrir propiedad ${safeTitle}">
        <img src="${image}" alt="${safeTitle}" loading="lazy" onerror="this.onerror=null;this.src='${PROPERTY_IMAGE_PLACEHOLDER}'">
        <div class="map-preview-content">
          <p class="map-preview-price">${getMapMarkerPriceLabel(property)}</p>
          <h3>${safeTitle}</h3>
          <p class="map-preview-location">${escapeHtml(locationLabel)}</p>
          ${shortSummary ? `<p class="map-preview-summary">${escapeHtml(shortSummary)}</p>` : ''}
        </div>
      </a>
    `;
  };

  const clearActiveMarker = () => {
    if (activeMarker) setMarkerActiveState(activeMarker, false);
    activeMarker = null;
  };
  geolocated.forEach((property) => {
    const markerPosition = getPropertyCoordinates(property);
    if (!markerPosition) return;
    bounds.push(markerPosition);

    const operation = normalizePropertyOperation(property.tipoOperacion || property.operacion || property.operation);
    const markerIcon = L.divIcon({
      className: 'map-price-marker-wrapper',
      html: `<div class="map-price-marker map-price-marker--${operation || 'venta'}">${getMapMarkerPriceLabel(property)}</div>`,
      iconSize: [106, 36],
      iconAnchor: [53, 18]
    });
    const marker = L.marker(markerPosition, { icon: markerIcon }).addTo(map);
    const previewPopup = L.popup({
      closeButton: false,
      autoPan: true,
      autoClose: false,
      className: 'map-preview-popup',
      offset: [0, -26]
    }).setContent(buildPreviewMarkup(property));

    marker.on('mouseover', () => {
      clearActiveMarker();
      setMarkerActiveState(marker, true);
      activeMarker = marker;
      marker.bindPopup(previewPopup).openPopup();
      activePopup = previewPopup;
    });

    marker.on('mouseout', () => {
      if (pointerMedia.matches) return;
      setTimeout(() => {
        if (activePopup && map.hasLayer(activePopup) && !document.querySelector('.map-preview-card:hover')) {
          map.closePopup(activePopup);
          clearActiveMarker();
          activePopup = null;
        }
      }, 120);
    });

    marker.on('click', () => {
      const detailUrl = getPropertyDetailUrl(property);
      if (pointerMedia.matches) {
        const isAlreadyActive = activeMarker === marker;
        clearActiveMarker();
        setMarkerActiveState(marker, true);
        activeMarker = marker;
        marker.bindPopup(previewPopup).openPopup();
        activePopup = previewPopup;
        if (isAlreadyActive) window.location.href = detailUrl;
        return;
      }
      window.location.href = detailUrl;
    });
  });

  map.fitBounds(bounds, { padding: [40, 40] });
}

(async function initProperties() {
  try {
    const agents = await loadAgents().catch(() => []);
    const initial = getInitialFilters();
    const filterForm = document.getElementById('filterForm');
    let hasRenderedGlobalMap = false;

    if (filterForm) {
      const filterLocation = document.getElementById('filterLocation');
      const filterType = document.getElementById('filterType');
      const filterOperation = document.getElementById('filterOperation');

      if (filterLocation) filterLocation.value = initial.ubicacion;
      if (filterType) filterType.value = initial.tipo;
      if (filterOperation) filterOperation.value = initial.operacion;
    }

    const renderCatalogViews = (properties) => {
      const marketProperties = properties.filter((property) => String(property.status || 'available').toLowerCase() !== 'sold');
      const agentFiltered = filterByAgent(marketProperties, initial.agent);

      renderFeatured(marketProperties);
      renderTerrenos(marketProperties);
      renderAlquileres(marketProperties);

      if (filterForm) {
        renderAgentFilterBanner(initial.agent, agents);
        renderPropertyList(applyFilters(agentFiltered));
      }

      renderPropertyDetail();

      if (!hasRenderedGlobalMap) {
        renderGlobalMap(agentFiltered);
        hasRenderedGlobalMap = true;
      }
    };

    const properties = await loadProperties();
    renderCatalogViews(properties);

    if (filterForm) {
      filterForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const params = new URLSearchParams(window.location.search);
        const filterLocationValue = document.getElementById('filterLocation')?.value.trim() || '';
        const filterTypeValue = normalizePropertyType(document.getElementById('filterType')?.value || '');
        const filterOperationValue = normalizePropertyOperation(document.getElementById('filterOperation')?.value || '');

        if (filterLocationValue) params.set('ubicacion', filterLocationValue); else params.delete('ubicacion');
        if (filterTypeValue) params.set('tipo', filterTypeValue); else params.delete('tipo');
        if (filterOperationValue) {
          params.set('operacion', filterOperationValue);
          params.set('tipoOperacion', filterOperationValue);
        } else {
          params.delete('operacion');
          params.delete('tipoOperacion');
        }

        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState({}, '', nextUrl);

        renderCatalogViews(allProperties);
      });
    }

    subscribeToProperties((updatedProperties) => {
      renderCatalogViews(updatedProperties);
    });
  } catch (error) {
    console.error('Error cargando propiedades:', error);
  }
})();
