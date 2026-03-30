const imageUtils = window.inmoImageUtils;
const fallbackPhoto = imageUtils?.PLACEHOLDER || 'assets/placeholder.svg';
const propertyUtils = window.inmoPropertyUtils || {};
const getPropertyTypeLabel = (value = '') => propertyUtils.getPropertyTypeLabel ? propertyUtils.getPropertyTypeLabel(value) : value;
const formatDualPrice = (usd) => propertyUtils.formatDualPrice ? propertyUtils.formatDualPrice(usd) : `$${Number(usd || 0).toLocaleString()} USD`;
const formatPricePerArea = (value, unit) => propertyUtils.formatPricePerArea ? propertyUtils.formatPricePerArea(value, unit) : '';
const calculatePricePerArea = (price, area) => propertyUtils.calculatePricePerArea ? propertyUtils.calculatePricePerArea(price, area) : NaN;
const getAreaDisplay = (property = {}) => propertyUtils.getAreaDisplay ? propertyUtils.getAreaDisplay(property) : `${property.area || 0} m²`;

const socialIcons = {
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5a4.25 4.25 0 0 0 4.25 4.25h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5a4.25 4.25 0 0 0-4.25-4.25h-8.5Zm8.9 2.35a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 22v-8.2h2.76l.41-3.2H13.7V8.56c0-.93.26-1.56 1.6-1.56h1.7V4.14A22.8 22.8 0 0 0 14.52 4c-2.45 0-4.14 1.5-4.14 4.24v2.36H7.6v3.2h2.78V22h3.32Z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 3c.38 1.96 1.55 3.38 3.43 4.13 1.03.4 1.93.5 2.47.52v3.14a9.26 9.26 0 0 1-4.36-1.14v5.9c0 3.1-2.55 5.45-5.72 5.45S4 18.65 4 15.52c0-3.12 2.55-5.48 5.92-5.48.33 0 .67.03 1 .1v3.2a2.94 2.94 0 0 0-.99-.17c-1.62 0-2.88 1.06-2.88 2.36 0 1.37 1.19 2.33 2.78 2.33 1.82 0 2.76-1.17 2.76-2.87V3h1.5Z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.93 9.93 0 0 0-8.6 14.9L2 22l5.27-1.38A9.97 9.97 0 0 0 12.04 22C17.53 22 22 17.54 22 12.05 22 6.47 17.54 2 12.04 2Zm0 18.26c-1.47 0-2.9-.4-4.15-1.15l-.3-.17-3.12.82.84-3.03-.2-.31a8.2 8.2 0 1 1 6.93 3.84Zm4.5-6.18c-.25-.12-1.47-.72-1.69-.8-.23-.08-.4-.12-.56.12-.16.24-.64.8-.79.96-.14.16-.3.18-.56.06-.25-.12-1.08-.4-2.06-1.27-.76-.67-1.28-1.5-1.43-1.75-.15-.24-.02-.37.11-.49.12-.12.26-.3.39-.45.13-.16.18-.27.27-.45.09-.18.05-.33-.02-.46-.07-.12-.56-1.35-.77-1.85-.2-.47-.4-.4-.56-.4h-.48c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.31.98 2.47c.12.16 1.68 2.56 4.07 3.59.57.25 1.02.4 1.37.52.58.19 1.11.16 1.53.1.46-.07 1.47-.6 1.68-1.17.21-.56.21-1.04.14-1.16-.07-.11-.23-.18-.48-.3Z"/></svg>'
};

function normalizeSocialUrl(url, network) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';

  if (network === 'whatsapp') {
    const clean = trimmed.replace(/[\s()+-]/g, '');
    if (/^https?:\/\//i.test(trimmed) || /^wa\.me\//i.test(trimmed)) {
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    }
    return `https://wa.me/${clean.replace(/^\+/, '')}`;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function socialLinkTemplate(url, label, network) {
  const normalizedUrl = normalizeSocialUrl(url, network);
  if (!normalizedUrl) return '';

  return `
    <a class="agent-public-social-link" href="${normalizedUrl}" target="_blank" rel="noopener noreferrer" aria-label="${label}">
      ${socialIcons[network] || ''}
      <span>${label}</span>
    </a>
  `;
}

function propertyCard(property) {
  const status = String(property.status || 'available').toLowerCase();
  return `
    <article class="property-card">
      <img src="${imageUtils.getCoverImage(property)}" alt="${property.title || property.titulo || 'Propiedad'}">
      <div class="property-card-content">
        <p class="badge">${getPropertyTypeLabel(property.type || property.tipo) || 'Propiedad'}</p>
        <h3>${property.title || property.titulo || 'Propiedad'}</h3>
        <p>${property.location || property.ubicacion || ''}</p>
        <p class="price">${formatDualPrice(property.priceUsd ?? property.price ?? property.precio)}</p>
        <p>Área: ${getAreaDisplay(property)}</p>
        <p>${formatPricePerArea(property.pricePerAreaUsd ?? calculatePricePerArea(property.priceUsd ?? property.price ?? property.precio, property.areaValue ?? property.area), property.areaUnit)}</p>
        ${status === 'sold' ? '<p class="property-status-tag">VENDIDA</p>' : ''}
        <a class="btn-primary-property" href="propiedad.html?id=${encodeURIComponent(property.id)}">Ver detalle</a>
      </div>
    </article>
  `;
}

function renderFriendlyMessage(message) {
  const status = document.getElementById('agentPublicStatus');
  const container = document.getElementById('agentPublicContent');

  status.textContent = message;
  container.innerHTML = `<p class="empty-state">${message}</p>`;
}

function getPropertyCoordinates(property) {
  const latitude = Number(property.latitude ?? property.lat);
  const longitude = Number(property.longitude ?? property.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return [latitude, longitude];
}

function renderAgentPropertiesMap(properties) {
  const mapElement = document.getElementById('agentPropertiesMap');
  if (!mapElement || typeof L === 'undefined') return;

  const geolocated = properties
    .map((property) => ({ property, coordinates: getPropertyCoordinates(property) }))
    .filter((item) => item.coordinates);

  if (!geolocated.length) {
    mapElement.innerHTML = '<p class="empty-state">Este agente aún no tiene propiedades con ubicación en el mapa.</p>';
    return;
  }

  const map = L.map(mapElement).setView([12.8654, -85.2072], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const bounds = [];
  geolocated.forEach(({ property, coordinates }) => {
    bounds.push(coordinates);

    L.marker(coordinates).addTo(map)
      .bindPopup(`
        <strong>${property.title || property.titulo || 'Propiedad'}</strong><br>
        <a href="propiedad.html?id=${encodeURIComponent(String(property.id || ''))}">Ver propiedad</a>
      `);
  });

  map.fitBounds(bounds, { padding: [35, 35] });
}


function getAgentRole(agent = {}) {
  return agent.role || agent.cargo || agent.position || '';
}

function getAgentLocation(agent = {}) {
  return agent.location || agent.ubicacion || agent.city || '';
}

function getAgentBasicInfo(agent = {}) {
  return [
    getAgentRole(agent),
    getAgentLocation(agent)
  ].filter(Boolean);
}

function renderAgentProfile(agent, properties) {
  const container = document.getElementById('agentPublicContent');
  const photo = agent.photo || fallbackPhoto;
  const basicInfo = getAgentBasicInfo(agent);
  const totalProperties = properties.length;

  const socialLinks = [
    socialLinkTemplate(agent.facebook, 'Facebook', 'facebook'),
    socialLinkTemplate(agent.instagram, 'Instagram', 'instagram'),
    socialLinkTemplate(agent.tiktok, 'TikTok', 'tiktok'),
    socialLinkTemplate(agent.whatsapp, 'WhatsApp', 'whatsapp')
  ].filter(Boolean);

  container.innerHTML = `
    <article class="agent-public-profile">
      <div class="agent-public-summary">
        <img class="agent-public-photo" src="${photo}" alt="${agent.name || 'Agente'}">
        <h2>${agent.name || 'Agente Diamantes Realty Group'}</h2>
        ${basicInfo.length ? `<p class="agent-public-basic-info">${basicInfo.join(' · ')}</p>` : ''}
        <p class="agent-public-description">${agent.description || 'Este agente todavía no ha agregado una descripción en su perfil.'}</p>
        ${(agent.phone || agent.email) ? `
          <div class="agent-public-contact">
            ${agent.phone ? `<p><strong>Tel:</strong> <a class="text-link" href="tel:${String(agent.phone).replace(/\s+/g, '')}">${agent.phone}</a></p>` : ''}
            ${agent.email ? `<p><strong>Email:</strong> <a class="text-link" href="mailto:${agent.email}">${agent.email}</a></p>` : ''}
          </div>
        ` : ''}
        ${socialLinks.length ? `<div class="agent-public-social" aria-label="Redes sociales de ${agent.name || 'agente'}">${socialLinks.join('')}</div>` : ''}
      </div>
      <aside class="agent-public-stats">
        <h3>Resumen</h3>
        <p><strong>${totalProperties}</strong> propiedades publicadas.</p>
        <p>Explora ubicaciones y detalles en el listado inferior.</p>
      </aside>
    </article>

    <section>
      <h2>Propiedades del agente</h2>
      <div class="properties-grid">
        ${totalProperties ? properties.map(propertyCard).join('') : '<p class="empty-state">Este agente aún no tiene propiedades publicadas.</p>'}
      </div>
    </section>

    <section class="agent-public-map-section">
      <h2>Mapa de propiedades del agente</h2>
      <div id="agentPropertiesMap" class="properties-map-full" aria-label="Mapa de propiedades del agente"></div>
    </section>
  `;

  renderAgentPropertiesMap(properties);
}

async function loadAgentProfile() {
  const status = document.getElementById('agentPublicStatus');
  const agentId = new URLSearchParams(window.location.search).get('id');

  if (!agentId) {
    renderFriendlyMessage('No encontramos el agente solicitado. Revisa el enlace e intenta de nuevo.');
    return;
  }

  const client = window.inmoFirebase;
  if (!client?.enabled || !client.db) {
    renderFriendlyMessage('No pudimos conectar con la base de datos en este momento. Intenta nuevamente en unos minutos.');
    return;
  }

  try {
    const agentDoc = await client.db.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) {
      renderFriendlyMessage('El agente solicitado no está disponible o ya no existe.');
      return;
    }

    const propertiesSnapshot = await client.db.collection('properties').where('agentId', '==', agentId).get();
    const properties = propertiesSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));

    status.textContent = 'Perfil cargado correctamente.';
    renderAgentProfile(agentDoc.data(), properties);
  } catch (error) {
    console.error('Error loading agent profile:', error);
    renderFriendlyMessage('Tuvimos un problema al cargar el perfil. Por favor, inténtalo más tarde.');
  }
}

function initAgentProfilePage() {
  if (window.inmoFirebase) {
    loadAgentProfile();
    return;
  }

  document.addEventListener('inmo:firebase-ready', loadAgentProfile, { once: true });

  setTimeout(() => {
    if (!window.inmoFirebase) {
      renderFriendlyMessage('No fue posible inicializar la conexión con la base de datos.');
    }
  }, 3000);
}

window.addEventListener('DOMContentLoaded', initAgentProfilePage);
