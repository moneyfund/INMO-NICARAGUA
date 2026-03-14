let allProperties = [];
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

function normalizeProperty(property = {}, id = '') {
  const title = property.title || property.titulo || '';
  const price = Number(property.price ?? property.precio ?? 0);
  const city = property.city || property.location || property.ubicacion || '';
  const image = property.image || (Array.isArray(property.images) ? property.images[0] : '') || '';
  const bedrooms = Number(property.bedrooms ?? property.habitaciones ?? 0);
  const bathrooms = Number(property.bathrooms ?? property.banos ?? 0);
  const area = Number(property.area ?? 0);
  const type = property.type || property.tipo || '';
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

function propertyCardTemplate(property) {
  const featuredClass = property.featured ? ' is-featured' : '';
  const status = (property.status || 'disponible').toLowerCase();
  const imageSrc = getPrimaryPropertyImage(property);
  const imageAlt = property.title || property.titulo || 'Imagen de la propiedad';
  const detailUrl = `propiedad.html?id=${encodeURIComponent(String(property.id ?? ''))}`;

  return `
    <article class="property-card${featuredClass}">
      <img src="${imageSrc}" alt="${imageAlt}" loading="lazy" onerror="this.onerror=null;this.src='${PROPERTY_IMAGE_PLACEHOLDER}'">
      <div class="property-card-content">
        <p class="badge">${property.tipo}</p>
        <h3>${property.title || property.titulo}</h3>
        <p>${property.city || property.ubicacion}</p>
        <p class="price">$${Number(property.price ?? property.precio ?? 0).toLocaleString()}</p>
        ${status === 'sold' ? '<p class="property-status-tag">VENDIDA</p>' : ''}
        <div class="property-meta">
          <span>${property.bedrooms ?? property.habitaciones} hab.</span>
          <span>${property.bathrooms ?? property.banos} baños</span>
          <span>${property.area} m²</span>
        </div>
        <p><a class="text-link" href="${detailUrl}">Ver detalle</a></p>
      </div>
    </article>
  `;
}

function getPropertyImages(property) {
  const imagesFromArray = Array.isArray(property.images)
    ? property.images
    : [];

  const normalizedImages = imagesFromArray
    .map(normalizePropertyImageUrl)
    .filter(Boolean);

  if (normalizedImages.length) return normalizedImages;

  const legacyImage = normalizePropertyImageUrl(property.image ?? '');
  return legacyImage ? [legacyImage] : [];
}

function getPrimaryPropertyImage(property) {
  const [primaryImage] = getPropertyImages(property);
  return primaryImage || PROPERTY_IMAGE_PLACEHOLDER;
}

function renderFeatured(properties) {
  const featuredGrid = document.getElementById('featuredGrid');
  if (!featuredGrid) return;
  featuredGrid.innerHTML = properties.slice(0, 3).map(propertyCardTemplate).join('');
  applyCardRevealAnimation(featuredGrid);
}

function renderCategory(properties, gridId, filterFn) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const filtered = properties.filter(filterFn).slice(0, 3);
  grid.innerHTML = filtered.map(propertyCardTemplate).join('');
  applyCardRevealAnimation(grid);
}

function renderTerrenos(properties) {
  renderCategory(properties, 'terrenosGrid', (property) => property.tipo === 'Terreno');
}

function renderAlquileres(properties) {
  const grid = document.getElementById('alquileresGrid');
  if (!grid) return;

  const rentalKeywords = ['alquiler', 'renta'];
  const rentals = properties.filter((property) => {
    const searchableFields = [property.tipo, property.titulo, property.descripcion]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return rentalKeywords.some((keyword) => searchableFields.includes(keyword));
  });

  const fallbackRentals = properties
    .filter((property) => property.tipo === 'Casa' || property.tipo === 'Apartamento')
    .slice(0, 3)
    .map((property) => ({ ...property, tipo: 'Alquiler' }));

  const cards = (rentals.length ? rentals.slice(0, 3) : fallbackRentals)
    .map(propertyCardTemplate)
    .join('');

  grid.innerHTML = cards;
  applyCardRevealAnimation(grid);
}

function renderPropertyList(properties) {
  const grid = document.getElementById('propertiesGrid');
  const emptyState = document.getElementById('emptyState');
  if (!grid) return;

  grid.innerHTML = properties.map(propertyCardTemplate).join('');
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
    tipo: params.get('tipo') || '',
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
  const typeInput = document.getElementById('filterType')?.value || '';
  const budgetInput = Number(document.getElementById('filterBudget')?.value || 0);

  return properties.filter((property) => {
    const matchesLocation = !locationInput || String(property.ubicacion || '').toLowerCase().includes(locationInput);
    const matchesType = !typeInput || property.tipo === typeInput;
    const matchesBudget = !budgetInput || Number(property.precio || 0) <= budgetInput;
    return matchesLocation && matchesType && matchesBudget;
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

function createAgentCardTemplate(agent, property) {
  if (!agent || !agent.id) return '';

  const agentPhoto = normalizePropertyImageUrl(agent.photo || agent.image || agent.avatar || '') || AGENT_IMAGE_PLACEHOLDER;
  const profileUrl = buildAgentProfileUrl(agent.id);
  const moreByAgentUrl = `propiedades.html?agent=${encodeURIComponent(agent.id)}`;

  return `
    <section class="agent-card-section" aria-label="Agente de la propiedad">
      <h2>Agente de esta propiedad</h2>
      <article class="agent-card">
        <img src="${agentPhoto}" alt="Foto de ${agent.name || 'agente'}" loading="lazy" onerror="this.onerror=null;this.src='${AGENT_IMAGE_PLACEHOLDER}'">
        <div class="agent-card-content">
          <h3>${agent.name || 'Agente inmobiliario'}</h3>
          <p>Agente inmobiliario</p>
          <div class="agent-card-actions">
            <a class="button-outline" href="${profileUrl}">Ver perfil del agente</a>
            <a class="button-outline" href="${moreByAgentUrl}">Ver más propiedades</a>
          </div>
        </div>
      </article>
    </section>
  `;
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
  const publishedByName = agent?.name || property.agentName || 'Agente inmobiliario';
  const agentProfileUrl = buildAgentProfileUrl(agent?.id || property.agentId);
  const status = String(property.status || 'available').toLowerCase();

  const galleryMarkup = galleryImages.length > 1
    ? `
      <button class="gallery-nav gallery-prev" type="button" aria-label="Imagen anterior">&#10094;</button>
      <button class="gallery-nav gallery-next" type="button" aria-label="Imagen siguiente">&#10095;</button>
      <div class="gallery-indicators" aria-label="Indicadores de imágenes"></div>
    `
    : '';

  detailContainer.innerHTML = `
    <div class="detail-grid">
      <section class="detail-gallery" data-gallery-images='${JSON.stringify(galleryImages)}'>
        <img class="detail-gallery-main-image" src="${getPrimaryPropertyImage(property)}" alt="${property.titulo || 'Imagen de la propiedad'}" loading="lazy" onerror="this.onerror=null;this.src='${PROPERTY_IMAGE_PLACEHOLDER}'">
        ${galleryMarkup}
      </section>
      <div>
        <p class="badge">${property.tipo}</p>
        <h1>${property.titulo}</h1>
        <p>${property.ubicacion}</p>
        <p class="price">$${Number(property.precio || 0).toLocaleString()}</p>
        <button id="favoritePropertyButton" class="favorite-property-button" type="button" aria-label="Guardar propiedad en favoritos" aria-pressed="false">🤍 Guardar</button>
        ${status === 'sold' ? '<p class="property-status-tag">VENDIDA</p>' : ''}
        <p>${property.descripcion}</p>
        <ul class="checklist">
          <li>${property.habitaciones} habitaciones</li>
          <li>${property.banos} baños</li>
          <li>${property.area} m² de construcción</li>
        </ul>
        <p><strong>Publicado por</strong><br>${publishedByName}</p>
        <a class="button-outline" href="${agentProfileUrl}">Para más información aquí</a>
      </div>
    </div>
    <section class="detail-map-section">
      <h2>Ubicación de la propiedad</h2>
      <div id="propertyMap" class="property-map"></div>
    </section>
    ${createAgentCardTemplate(agent, property)}
    <section class="property-reviews-section" id="propertyReviews"></section>
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
  const gallery = scope.querySelector('.detail-gallery');
  if (!gallery) return;

  const mainImage = gallery.querySelector('.detail-gallery-main-image');
  if (!mainImage) return;

  const images = (() => {
    try {
      const parsed = JSON.parse(gallery.dataset.galleryImages || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  })();

  if (!images.length) return;

  const indicators = gallery.querySelector('.gallery-indicators');
  let currentIndex = 0;
  let pointerStartX = 0;

  function updateImage(index) {
    currentIndex = (index + images.length) % images.length;
    mainImage.src = images[currentIndex] || PROPERTY_IMAGE_PLACEHOLDER;
    mainImage.alt = `Imagen ${currentIndex + 1} de ${images.length}`;

    if (!indicators) return;
    indicators.querySelectorAll('button').forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === currentIndex);
      dot.setAttribute('aria-current', dotIndex === currentIndex ? 'true' : 'false');
    });
  }

  if (indicators) {
    indicators.innerHTML = images
      .map((_, index) => `<button type="button" aria-label="Ver imagen ${index + 1}"></button>`)
      .join('');

    indicators.querySelectorAll('button').forEach((dot, dotIndex) => {
      dot.addEventListener('click', () => updateImage(dotIndex));
    });
  }

  gallery.querySelector('.gallery-prev')?.addEventListener('click', () => updateImage(currentIndex - 1));
  gallery.querySelector('.gallery-next')?.addEventListener('click', () => updateImage(currentIndex + 1));

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

  updateImage(0);
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
  geolocated.forEach((property) => {
    const markerPosition = getPropertyCoordinates(property);
    if (!markerPosition) return;
    bounds.push(markerPosition);

    L.marker(markerPosition).addTo(map)
      .bindPopup(`
        <strong>${property.titulo}</strong><br>
        <a href="propiedad.html?id=${encodeURIComponent(String(property.id ?? ''))}">Ver propiedad</a>
      `);
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

      if (filterLocation) filterLocation.value = initial.ubicacion;
      if (filterType) filterType.value = initial.tipo;
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
