const fallbackPhoto = 'assets/placeholder.svg';

function socialLinkTemplate(url, label) {
  if (!url) return '';
  return `<a class="text-link" href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function propertyCard(property) {
  const status = String(property.status || 'available').toLowerCase();
  return `
    <article class="property-card">
      <img src="${property.image || property.images?.[0] || fallbackPhoto}" alt="${property.title || property.titulo || 'Propiedad'}">
      <div class="property-card-content">
        <p class="badge">${property.type || property.tipo || 'Propiedad'}</p>
        <h3>${property.title || property.titulo || 'Propiedad'}</h3>
        <p>${property.location || property.ubicacion || ''}</p>
        <p class="price">$${Number(property.price || property.precio || 0).toLocaleString()}</p>
        ${status === 'sold' ? '<p class="property-status-tag">VENDIDA</p>' : ''}
        <a class="text-link" href="propiedad.html?id=${encodeURIComponent(property.id)}">Ver detalle</a>
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

function renderAgentProfile(agent, properties) {
  const container = document.getElementById('agentPublicContent');
  const photo = agent.photo || fallbackPhoto;

  container.innerHTML = `
    <article class="agent-public-profile">
      <img src="${photo}" alt="${agent.name || 'Agente'}">
      <div>
        <h2>${agent.name || 'Agente INMO NICARAGUA'}</h2>
        <p>${agent.description || ''}</p>
        <p>${socialLinkTemplate(agent.instagram, 'Instagram')} ${socialLinkTemplate(agent.facebook, 'Facebook')} ${socialLinkTemplate(agent.tiktok, 'TikTok')} ${socialLinkTemplate(agent.whatsapp, 'WhatsApp')}</p>
      </div>
    </article>
    <section>
      <h2>Propiedades del agente</h2>
      <div class="properties-grid">
        ${properties.length ? properties.map(propertyCard).join('') : '<p class="empty-state">Este agente aún no tiene propiedades publicadas.</p>'}
      </div>
    </section>
  `;
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
    const properties = propertiesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

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
