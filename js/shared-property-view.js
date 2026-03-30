import {
  db,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from './firebase-services.js';

const imageUtils = window.inmoImageUtils || {};
const propertyUtils = window.inmoPropertyUtils || {};

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: (params.get('token') || '').trim(),
    propertyId: (params.get('propertyId') || '').trim()
  };
}

function formatPrice(price = 0) {
  return propertyUtils.formatDualPrice ? propertyUtils.formatDualPrice(price) : `$${Number(price || 0).toLocaleString('en-US')} USD`;
}

function formatOperation(value = '') {
  return String(value || '').toLowerCase() === 'alquiler' ? 'Alquiler' : 'Venta';
}

function formatType(type = '') {
  return propertyUtils.getPropertyTypeLabel ? propertyUtils.getPropertyTypeLabel(type) : type;
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

function normalizeProperty(property = {}, id = '') {
  const title = property.title || property.titulo || 'Propiedad';
  const location = property.location || property.ubicacion || 'Ubicación no disponible';
  const price = Number(property.priceUsd ?? property.price ?? property.precio ?? 0);
  const type = propertyUtils.normalizePropertyType ? propertyUtils.normalizePropertyType(property.type || property.tipo || '') : (property.type || property.tipo || '');
  const operation = propertyUtils.normalizeOperation ? propertyUtils.normalizeOperation(property.operation || property.operacion || property.tipoOperacion || 'venta') : (property.operation || property.operacion || 'venta');
  const bedrooms = Number(property.bedrooms ?? property.habitaciones ?? 0);
  const bathrooms = Number(property.bathrooms ?? property.banos ?? 0);
  const areaValue = Number(property.areaValue ?? property.area ?? 0);
  const areaUnit = property.areaUnit || 'metros';
  const description = property.description || property.descripcion || '';
  const image = imageUtils.getCoverImage ? imageUtils.getCoverImage(property) : (property.image || property.imagen || 'assets/placeholder.svg');

  return { id, title, location, price, type, operation, bedrooms, bathrooms, areaValue, areaUnit, description, image };
}

function renderUnavailable(message) {
  const page = document.getElementById('sharedPropertyPage');
  if (!page) return;

  page.innerHTML = `
    <section class="dashboard-card shared-empty-state">
      <h1>Detalle no disponible</h1>
      <p>${message}</p>
      <a class="button-secondary" href="index.html">Volver al inicio</a>
    </section>
  `;
}

function renderSharedProperty(sharedList, property) {
  const page = document.getElementById('sharedPropertyPage');
  if (!page) return;

  const contactName = sharedList.createdByAgentName || 'Asesor inmobiliario';
  const contactPhone = sharedList.createdByAgentWhatsapp || sharedList.createdByAgentPhone || '';
  const contactPhoto = sharedList.createdByAgentPhoto || 'assets/placeholder.svg';
  const waLink = whatsappLink(contactPhone, `Hola ${contactName}, quiero información sobre ${property.title}.`);

  page.innerHTML = `
    <div class="detail-grid shared-detail-grid">
      <section class="detail-gallery">
        <img class="detail-gallery-main-image" src="${property.image}" alt="${property.title}" loading="lazy">
      </section>
      <div>
        <p class="badge">${formatType(property.type)} en ${formatOperation(property.operation).toLowerCase()}</p>
        <h1>${property.title}</h1>
        <p>${property.location}</p>
        <p class="price">${formatPrice(property.price)}</p>
        <p><strong>Área:</strong> ${property.areaValue || 0} ${property.areaUnit}</p>
        <p><strong>Precio por área:</strong> ${formatPricePerArea(property.price, property.areaValue, property.areaUnit)}</p>
        <p>${property.description}</p>
        <ul class="checklist property-feature-list">
          <li>🛏️ ${property.bedrooms} habitaciones</li>
          <li>🛁 ${property.bathrooms} baños</li>
          <li>📐 ${property.areaValue || 0} ${property.areaUnit}</li>
        </ul>
      </div>
    </div>

    <section class="agent-card-section" aria-label="Asesor de la selección compartida">
      <h2>Tu asesor asignado</h2>
      <article class="agent-card">
        <img src="${contactPhoto}" alt="Foto de ${contactName}" loading="lazy">
        <div class="agent-card-content">
          <h3>${contactName}</h3>
          <p>Contacto exclusivo de esta selección</p>
          <div class="agent-card-actions">
            <a class="button-outline" href="${waLink}" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a>
            <a class="button-outline" href="share.html?token=${encodeURIComponent(sharedList.token)}">Volver a la lista</a>
          </div>
        </div>
      </article>
    </section>
  `;
}

async function init() {
  const { token, propertyId } = getParams();
  if (!token || !propertyId) {
    renderUnavailable('El enlace compartido no es válido.');
    return;
  }

  const sharedList = await loadSharedList(token);
  if (!sharedList || sharedList.status !== 'active') {
    renderUnavailable('Esta lista compartida no está disponible.');
    return;
  }

  const listedProperties = Array.isArray(sharedList.propertyIds) ? sharedList.propertyIds : [];
  if (!listedProperties.includes(propertyId)) {
    renderUnavailable('Esta propiedad no forma parte de la selección compartida.');
    return;
  }

  const propertySnap = await getDoc(doc(db, 'properties', propertyId));
  if (!propertySnap.exists()) {
    renderUnavailable('La propiedad fue removida o no está disponible.');
    return;
  }

  const property = normalizeProperty(propertySnap.data(), propertySnap.id);
  renderSharedProperty(sharedList, property);
}

window.addEventListener('DOMContentLoaded', () => {
  init().catch((error) => {
    console.error('Error cargando detalle compartido:', error);
    renderUnavailable('Ocurrió un error al cargar este detalle compartido.');
  });
});
