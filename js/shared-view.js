import {
  db,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  documentId
} from './firebase-services.js';

const imageUtils = window.inmoImageUtils || {};
const propertyUtils = window.inmoPropertyUtils || {};

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get('token');
  if (queryToken) return queryToken.trim();

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'share' && pathParts[1]) return decodeURIComponent(pathParts[1]);
  return '';
}

function normalizeProperty(property = {}, id = '') {
  const price = Number(property.priceUsd ?? property.price ?? property.precio ?? 0);
  const areaValue = Number(property.areaValue ?? property.area ?? 0);
  return {
    ...property,
    id,
    title: property.title || property.titulo || 'Propiedad',
    location: property.location || property.ubicacion || 'Ubicación no disponible',
    type: propertyUtils.normalizePropertyType ? propertyUtils.normalizePropertyType(property.type || property.tipo || '') : (property.type || property.tipo || ''),
    operation: propertyUtils.normalizeOperation ? propertyUtils.normalizeOperation(property.operation || property.operacion || property.tipoOperacion || 'venta') : (property.operation || property.operacion || 'venta'),
    bedrooms: Number(property.bedrooms ?? property.habitaciones ?? 0),
    bathrooms: Number(property.bathrooms ?? property.banos ?? 0),
    areaValue,
    areaUnit: property.areaUnit || 'metros',
    price,
    image: imageUtils.getCoverImage ? imageUtils.getCoverImage(property) : (property.image || property.imagen || 'assets/placeholder.svg')
  };
}

function formatOperation(value = '') {
  const normalized = String(value || '').toLowerCase();
  return normalized === 'alquiler' ? 'Alquiler' : 'Venta';
}

function formatType(type = '') {
  return propertyUtils.getPropertyTypeLabel ? propertyUtils.getPropertyTypeLabel(type) : type;
}

function formatPrice(price = 0) {
  return propertyUtils.formatDualPrice ? propertyUtils.formatDualPrice(price) : `$${Number(price || 0).toLocaleString('en-US')} USD`;
}

function formatPricePerArea(price = 0, area = 0, unit = 'metros') {
  const perArea = propertyUtils.calculatePricePerArea ? propertyUtils.calculatePricePerArea(price, area) : NaN;
  return propertyUtils.formatPricePerArea ? propertyUtils.formatPricePerArea(perArea, unit) : '';
}

function whatsappLink(phone = '', text = '') {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '#';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

async function loadSharedList(token) {
  const sharedQuery = query(collection(db, 'sharedPropertyLists'), where('token', '==', token));
  const snapshot = await getDocs(sharedQuery);
  const first = snapshot.docs[0];
  if (!first) return null;
  return { id: first.id, ...first.data() };
}

async function loadPropertiesByIds(ids = []) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const chunks = [];
  for (let index = 0; index < unique.length; index += 10) {
    chunks.push(unique.slice(index, index + 10));
  }

  const loaded = [];
  for (const chunk of chunks) {
    const snap = await getDocs(query(collection(db, 'properties'), where(documentId(), 'in', chunk)));
    snap.forEach((entry) => loaded.push(normalizeProperty(entry.data(), entry.id)));
  }

  const orderMap = new Map(unique.map((id, index) => [id, index]));
  return loaded.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
}

function renderUnavailable(message = 'Esta lista compartida no está disponible.') {
  const page = document.getElementById('sharedListPage');
  if (!page) return;

  page.innerHTML = `
    <section class="dashboard-card shared-empty-state">
      <h1>Lista no disponible</h1>
      <p>${message}</p>
      <a class="button-secondary" href="index.html">Ir al inicio</a>
    </section>
  `;
}

function renderSharedList(sharedList, properties) {
  const page = document.getElementById('sharedListPage');
  if (!page) return;

  if (!properties.length) {
    renderUnavailable('Esta selección no tiene propiedades disponibles en este momento.');
    return;
  }

  const contactName = sharedList.createdByAgentName || 'Asesor inmobiliario';
  const contactPhone = sharedList.createdByAgentWhatsapp || sharedList.createdByAgentPhone || '';
  const contactPhoto = sharedList.createdByAgentPhoto || 'assets/placeholder.svg';
  const waLink = whatsappLink(contactPhone, `Hola ${contactName}, vi tu selección compartida y quiero más información.`);

  page.innerHTML = `
    <section class="shared-header dashboard-card">
      <div class="shared-agent-chip">
        <img src="${contactPhoto}" alt="Foto de ${contactName}">
        <div>
          <p class="badge">Selección compartida para ti</p>
          <h1>${sharedList.title || 'Lista compartida'}</h1>
          <p>Asesor: <strong>${contactName}</strong>${sharedList.clientName ? ` · Cliente: ${sharedList.clientName}` : ''}</p>
        </div>
      </div>
      <a class="button-secondary" href="${waLink}" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a>
    </section>

    <section class="properties-grid">
      ${properties.map((property) => `
        <article class="property-card">
          <img src="${property.image}" alt="${property.title}" loading="lazy">
          <div class="property-card-content">
            <p class="badge">${formatType(property.type)} en ${formatOperation(property.operation).toLowerCase()}</p>
            <h3>${property.title}</h3>
            <p>${property.location}</p>
            <p class="price">${formatPrice(property.price)}</p>
            <p>${formatPricePerArea(property.price, property.areaValue, property.areaUnit)}</p>
            <div class="property-meta property-meta-icons">
              <span>🛏️ ${property.bedrooms} hab.</span>
              <span>🛁 ${property.bathrooms} baños</span>
              <span>📐 ${property.areaValue || 0} ${property.areaUnit}</span>
            </div>
            <div class="agent-actions">
              <a class="button-outline" href="share-property.html?token=${encodeURIComponent(sharedList.token)}&propertyId=${encodeURIComponent(property.id)}">Ver detalle</a>
              <a class="button-outline" href="${waLink}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </div>
          </div>
        </article>
      `).join('')}
    </section>
  `;
}

async function init() {
  const token = getTokenFromUrl();
  if (!token) {
    renderUnavailable('El enlace no contiene un token válido.');
    return;
  }

  const sharedList = await loadSharedList(token);
  if (!sharedList) {
    renderUnavailable('No encontramos esta lista compartida.');
    return;
  }

  if (sharedList.status !== 'active') {
    renderUnavailable('Esta lista fue desactivada por el asesor.');
    return;
  }

  const propertyIds = Array.isArray(sharedList.propertyIds) ? sharedList.propertyIds : [];
  if (!propertyIds.length) {
    renderUnavailable('La lista no contiene propiedades activas.');
    return;
  }

  const properties = await loadPropertiesByIds(propertyIds);
  renderSharedList(sharedList, properties);
}

window.addEventListener('DOMContentLoaded', () => {
  init().catch((error) => {
    console.error('Error cargando lista compartida:', error);
    renderUnavailable('Ocurrió un problema al abrir la lista compartida.');
  });
});
