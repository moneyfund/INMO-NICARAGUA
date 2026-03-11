let allProperties = [];
const PROPERTY_IMAGE_PLACEHOLDER = 'assets/placeholder.svg';


const FACEBOOK_IMAGE_DOMAINS = ['facebook.com', 'fbcdn.net'];
const SWIPE_THRESHOLD = 45;

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

async function loadProperties() {
  const response = await fetch('data/propiedades.json');
  allProperties = await response.json();
  return allProperties;
}

function propertyCardTemplate(property) {
  const featuredClass = property.featured ? ' is-featured' : '';
  const imageSrc = getPrimaryPropertyImage(property);
  const imageAlt = property.titulo || 'Imagen de la propiedad';
  const detailUrl = `propiedad.html?id=${encodeURIComponent(String(property.id ?? ''))}`;

  return `
    <article class="property-card${featuredClass}">
      <img src="${imageSrc}" alt="${imageAlt}" loading="lazy" onerror="this.onerror=null;this.src='${PROPERTY_IMAGE_PLACEHOLDER}'">
      <div class="property-card-content">
        <p class="badge">${property.tipo}</p>
        <h3>${property.titulo}</h3>
        <p>${property.ubicacion}</p>
        <p class="price">$${property.precio.toLocaleString()}</p>
        <div class="property-meta">
          <span>${property.habitaciones} hab.</span>
          <span>${property.banos} baños</span>
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
    tipo: params.get('tipo') || ''
  };
}

function applyFilters(properties) {
  const locationInput = document.getElementById('filterLocation')?.value.trim().toLowerCase() || '';
  const typeInput = document.getElementById('filterType')?.value || '';
  const budgetInput = Number(document.getElementById('filterBudget')?.value || 0);

  return properties.filter((property) => {
    const matchesLocation = !locationInput || property.ubicacion.toLowerCase().includes(locationInput);
    const matchesType = !typeInput || property.tipo === typeInput;
    const matchesBudget = !budgetInput || property.precio <= budgetInput;
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

function renderPropertyDetail(properties) {
  const detailContainer = document.getElementById('propertyDetail');
  if (!detailContainer) return;

  const params = new URLSearchParams(window.location.search);
  const propertyId = params.get('id');

  if (!propertyId) {
    detailContainer.innerHTML = '<p>Selecciona una propiedad desde el catálogo para ver su detalle. <a href="propiedades.html" class="text-link">Ir al catálogo</a></p>';
    return;
  }

  const property = properties.find((item) => String(item.id) === propertyId);

  if (!property) {
    detailContainer.innerHTML = '<p>Propiedad no encontrada. <a href="propiedades.html" class="text-link">Regresar al catálogo</a></p>';
    return;
  }

  const galleryImages = getPropertyImages(property);

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
        <p class="price">$${property.precio.toLocaleString()}</p>
        <p>${property.descripcion}</p>
        <ul class="checklist">
          <li>${property.habitaciones} habitaciones</li>
          <li>${property.banos} baños</li>
          <li>${property.area} m² de construcción</li>
        </ul>
        <a class="button-outline" href="contacto.html">Solicitar visita privada</a>
      </div>
    </div>
    <section class="detail-map-section">
      <h2>Ubicación de la propiedad</h2>
      <div id="propertyMap" class="property-map"></div>
    </section>
    <section class="property-reviews-section" id="propertyReviews">
      <div class="property-reviews-header">
        <h2>Opiniones de la propiedad</h2>
        <div class="reviews-auth-controls" data-auth-controls></div>
      </div>
      <p class="reviews-firebase-status" data-firebase-status></p>
      <div class="reviews-summary" data-reviews-summary>
        <p class="reviews-stars" data-average-stars>☆ ☆ ☆ ☆ ☆</p>
        <p class="reviews-average" data-average-value>0.0 / 5</p>
        <p class="reviews-count" data-review-count>(0 reseñas)</p>
      </div>
      <div class="reviews-list" data-reviews-list>
        <p class="reviews-empty">Aún no hay opiniones para esta propiedad.</p>
      </div>
      <form class="review-form" data-review-form>
        <div class="review-form-stars" aria-label="Calificación de estrellas">
          <button type="button" data-rating-star="1" aria-label="1 estrella">★</button>
          <button type="button" data-rating-star="2" aria-label="2 estrellas">★</button>
          <button type="button" data-rating-star="3" aria-label="3 estrellas">★</button>
          <button type="button" data-rating-star="4" aria-label="4 estrellas">★</button>
          <button type="button" data-rating-star="5" aria-label="5 estrellas">★</button>
        </div>
        <input type="hidden" name="rating" value="0">
        <textarea name="comment" rows="4" placeholder="Comparte tu opinión sobre esta propiedad..."></textarea>
        <button type="submit">Publicar reseña</button>
        <p class="review-form-message" data-review-form-message></p>
      </form>
    </section>
  `;

  initPropertyGallery(detailContainer);
  renderPropertyDetailMap(property);
  window.dispatchEvent(new CustomEvent('propertyDetailReady', {
    detail: {
      property,
      propertyId
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
    const properties = await loadProperties();
    renderFeatured(properties);
    renderTerrenos(properties);
    renderAlquileres(properties);

    const filterForm = document.getElementById('filterForm');
    if (filterForm) {
      const initial = getInitialFilters();
      const filterLocation = document.getElementById('filterLocation');
      const filterType = document.getElementById('filterType');

      if (filterLocation) filterLocation.value = initial.ubicacion;
      if (filterType) filterType.value = initial.tipo;

      renderPropertyList(applyFilters(properties));
      filterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        renderPropertyList(applyFilters(properties));
      });
    }

    renderPropertyDetail(properties);
    renderGlobalMap(properties);
  } catch (error) {
    console.error('Error cargando propiedades:', error);
  }
})();
