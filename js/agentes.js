async function loadAgents() {
  const response = await fetch('data/agents.json');
  if (!response.ok) throw new Error('No se pudieron cargar los agentes');
  return response.json();
}

function socialLinkTemplate(url, label, icon) {
  if (!url) return '';

  return `
    <a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${label}">
      ${icon}
    </a>
  `;
}

function agentCardTemplate(agent) {
  const instagramIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5a4.25 4.25 0 0 0 4.25 4.25h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5a4.25 4.25 0 0 0-4.25-4.25h-8.5Zm8.9 2.35a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/></svg>';
  const facebookIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 22v-8.2h2.76l.41-3.2H13.7V8.56c0-.93.26-1.56 1.6-1.56h1.7V4.14A22.8 22.8 0 0 0 14.52 4c-2.45 0-4.14 1.5-4.14 4.24v2.36H7.6v3.2h2.78V22h3.32Z"/></svg>';
  const tiktokIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 3c.38 1.96 1.55 3.38 3.43 4.13 1.03.4 1.93.5 2.47.52v3.14a9.26 9.26 0 0 1-4.36-1.14v5.9c0 3.1-2.55 5.45-5.72 5.45S4 18.65 4 15.52c0-3.12 2.55-5.48 5.92-5.48.33 0 .67.03 1 .1v3.2a2.94 2.94 0 0 0-.99-.17c-1.62 0-2.88 1.06-2.88 2.36 0 1.37 1.19 2.33 2.78 2.33 1.82 0 2.76-1.17 2.76-2.87V3h1.5Z"/></svg>';
  const whatsappIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.93 9.93 0 0 0-8.6 14.9L2 22l5.27-1.38A9.97 9.97 0 0 0 12.04 22C17.53 22 22 17.54 22 12.05 22 6.47 17.54 2 12.04 2Zm0 18.26c-1.47 0-2.9-.4-4.15-1.15l-.3-.17-3.12.82.84-3.03-.2-.31a8.2 8.2 0 1 1 6.93 3.84Zm4.5-6.18c-.25-.12-1.47-.72-1.69-.8-.23-.08-.4-.12-.56.12-.16.24-.64.8-.79.96-.14.16-.3.18-.56.06-.25-.12-1.08-.4-2.06-1.27-.76-.67-1.28-1.5-1.43-1.75-.15-.24-.02-.37.11-.49.12-.12.26-.3.39-.45.13-.16.18-.27.27-.45.09-.18.05-.33-.02-.46-.07-.12-.56-1.35-.77-1.85-.2-.47-.4-.4-.56-.4h-.48c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.31.98 2.47c.12.16 1.68 2.56 4.07 3.59.57.25 1.02.4 1.37.52.58.19 1.11.16 1.53.1.46-.07 1.47-.6 1.68-1.17.21-.56.21-1.04.14-1.16-.07-.11-.23-.18-.48-.3Z"/></svg>';

  return `
    <article class="agent-card reveal-on-scroll">
      <img class="agent-photo" src="${agent.photo}" alt="${agent.name}">
      <div class="agent-content">
        <h2>${agent.name}</h2>
        <p>${agent.description || ''}</p>
        ${agent.phone ? `<p><strong>Tel:</strong> <a class="text-link" href="tel:${String(agent.phone).replace(/\s+/g, '')}">${agent.phone}</a></p>` : ''}
        ${agent.email ? `<p><strong>Email:</strong> <a class="text-link" href="mailto:${agent.email}">${agent.email}</a></p>` : ''}
        <div class="agent-social" aria-label="Redes sociales de ${agent.name}">
          ${socialLinkTemplate(agent.instagram, 'Instagram', instagramIcon)}
          ${socialLinkTemplate(agent.facebook, 'Facebook', facebookIcon)}
          ${socialLinkTemplate(agent.tiktok, 'TikTok', tiktokIcon)}
          ${socialLinkTemplate(agent.whatsapp, 'WhatsApp', whatsappIcon)}
        </div>
        <a class="button-outline" href="propiedades.html?agent=${encodeURIComponent(agent.id)}">Ver propiedades</a>
      </div>
    </article>
  `;
}

function applyAgentRevealAnimation(container) {
  const cards = container.querySelectorAll('.agent-card.reveal-on-scroll');
  if (!cards.length) return;

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

  cards.forEach((card, index) => {
    card.style.transitionDelay = `${index * 80}ms`;
    observer.observe(card);
  });
}

(async function initAgents() {
  const grid = document.getElementById('agentsGrid');
  if (!grid) return;

  try {
    const agents = await loadAgents();
    grid.innerHTML = agents.map((agent) => agentCardTemplate(agent)).join('');
    applyAgentRevealAnimation(grid);
  } catch (error) {
    console.error('Error cargando agentes:', error);
    grid.innerHTML = '<p class="empty-state">No fue posible cargar los agentes en este momento.</p>';
  }
})();
