const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('themeMode');

const siteHeader = document.querySelector('.site-header');

if (siteHeader) {
  siteHeader.classList.remove('scrolled', 'is-scrolled');
}

function applyTheme(theme) {
  const isDarkMode = theme === 'dark';
  document.body.classList.toggle('dark', isDarkMode);
  document.body.classList.toggle('dark-mode', isDarkMode);
  document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

  if (themeToggle) {
    themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro');
  }
}

function initializeLucideIcons() {
  if (typeof window === 'undefined' || !window.lucide || typeof window.lucide.createIcons !== 'function') return;
  window.lucide.createIcons();
}

applyTheme(savedTheme === 'dark' ? 'dark' : 'light');

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    localStorage.setItem('themeMode', nextTheme);
    applyTheme(nextTheme);
  });
}


const footerLinks = [
  { href: 'politicas-de-privacidad.html', label: 'Políticas de Privacidad' },
  { href: 'condiciones-de-uso.html', label: 'Condiciones de Uso' },
  { href: 'licencia-de-operacion.html', label: 'Licencia de Operación' }
];

const footerSocialLinks = [
  {
    href: 'https://instagram.com/',
    label: 'Instagram',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5a4.25 4.25 0 0 0 4.25 4.25h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5a4.25 4.25 0 0 0-4.25-4.25h-8.5Zm8.9 2.35a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/></svg>'
  },
  {
    href: 'https://facebook.com/',
    label: 'Facebook',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 22v-8.2h2.76l.41-3.2H13.7V8.56c0-.93.26-1.56 1.6-1.56h1.7V4.14A22.8 22.8 0 0 0 14.52 4c-2.45 0-4.14 1.5-4.14 4.24v2.36H7.6v3.2h2.78V22h3.32Z"/></svg>'
  },
  {
    href: 'https://www.tiktok.com/',
    label: 'TikTok',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 3c.38 1.96 1.55 3.38 3.43 4.13 1.03.4 1.93.5 2.47.52v3.14a9.26 9.26 0 0 1-4.36-1.14v5.9c0 3.1-2.55 5.45-5.72 5.45S4 18.65 4 15.52c0-3.12 2.55-5.48 5.92-5.48.33 0 .67.03 1 .1v3.2a2.94 2.94 0 0 0-.99-.17c-1.62 0-2.88 1.06-2.88 2.36 0 1.37 1.19 2.33 2.78 2.33 1.82 0 2.76-1.17 2.76-2.87V3h1.5Z"/></svg>'
  },
  {
    href: 'mailto:correo@inmonicaragua.com',
    label: 'Gmail',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.75 5.5h16.5A1.75 1.75 0 0 1 22 7.25v9.5a1.75 1.75 0 0 1-1.75 1.75H3.75A1.75 1.75 0 0 1 2 16.75v-9.5A1.75 1.75 0 0 1 3.75 5.5Zm0 1.5v.2l8.25 5.7 8.25-5.7V7H3.75Zm16.75 9.75V8.91l-8.07 5.57a.75.75 0 0 1-.86 0L3.5 8.91v7.84c0 .14.11.25.25.25h16.5c.14 0 .25-.11.25-.25Z"/></svg>'
  }
];

function renderSiteFooter() {
  const footerMarkup = `
    <div class="container footer-content">
      <nav class="footer-legal-nav" aria-label="Enlaces legales">
        ${footerLinks.map((link) => `<a class="footer-legal-link" href="${link.href}">${link.label}</a>`).join('')}
      </nav>
      <div class="footer-social" aria-label="Redes sociales de INMO NICARAGUA">
        ${footerSocialLinks.map((link) => `<a class="footer-social-link" href="${link.href}" ${link.href.startsWith('mailto:') ? '' : 'target="_blank" rel="noopener noreferrer"'} aria-label="${link.label}" title="${link.label}">${link.icon}</a>`).join('')}
      </div>
      <p class="footer-text">© <span id="currentYear"></span> INMO NICARAGUA</p>
    </div>
  `;

  let footer = document.querySelector('.site-footer');
  if (!footer) {
    footer = document.createElement('footer');
    footer.className = 'site-footer';
    document.body.appendChild(footer);
  }

  footer.innerHTML = footerMarkup;
}

renderSiteFooter();

const yearElement = document.getElementById('currentYear');
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

const heroSearchForm = document.getElementById('heroSearchForm');
if (heroSearchForm) {
  heroSearchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const location = document.getElementById('searchInput').value.trim();
    const type = document.getElementById('typeInput').value;

    const params = new URLSearchParams();
    if (location) params.set('ubicacion', location);
    if (type) params.set('tipo', type);

    window.location.href = `propiedades.html?${params.toString()}`;
  });
}

const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const contactParams = new URLSearchParams(window.location.search);
  const agentName = contactParams.get('agentName') || '';
  const propertyTitle = contactParams.get('propertyTitle') || '';
  const messageField = document.getElementById('mensaje');

  if (messageField && (agentName || propertyTitle)) {
    const prefilledMessage = [
      'Hola, me interesa esta propiedad y deseo más información.',
      agentName ? `Agente: ${agentName}` : '',
      propertyTitle ? `Propiedad: ${propertyTitle}` : ''
    ].filter(Boolean).join('\n');

    messageField.value = prefilledMessage;
  }

  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = document.getElementById('formMessage');
    message.textContent = 'Gracias por tu consulta. Nuestro equipo te contactará en breve.';
    contactForm.reset();
  });
}

const whatsappFloat = document.getElementById('whatsapp-float');

function getRandomMoveDuration() {
  return Math.floor(Math.random() * 8000) + 12000;
}

function getPauseBetweenMoves() {
  return Math.floor(Math.random() * 2000) + 2000;
}

function getViewportBounds(element, padding = 24) {
  const maxX = Math.max(window.innerWidth - element.offsetWidth - padding, padding);
  const maxY = Math.max(window.innerHeight - element.offsetHeight - padding, padding);

  return {
    minX: padding,
    minY: padding,
    maxX,
    maxY,
  };
}

function getRandomPosition(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function moveWhatsappButton() {
  if (!whatsappFloat) return;

  const { minX, minY, maxX, maxY } = getViewportBounds(whatsappFloat);

  const nextX = getRandomPosition(minX, maxX);
  const nextY = getRandomPosition(minY, maxY);
  const duration = getRandomMoveDuration();

  whatsappFloat.style.setProperty('--whatsapp-move-duration', `${duration}ms`);
  whatsappFloat.style.left = `${nextX}px`;
  whatsappFloat.style.top = `${nextY}px`;

  return duration;
}

function keepWhatsappInViewport() {
  if (!whatsappFloat) return;

  const { minX, minY, maxX, maxY } = getViewportBounds(whatsappFloat);
  const currentX = parseFloat(whatsappFloat.style.left) || maxX;
  const currentY = parseFloat(whatsappFloat.style.top) || maxY;

  whatsappFloat.style.left = `${clamp(currentX, minX, maxX)}px`;
  whatsappFloat.style.top = `${clamp(currentY, minY, maxY)}px`;
}

if (whatsappFloat) {
  keepWhatsappInViewport();

  const runWhatsappAnimation = () => {
    const duration = moveWhatsappButton();
    const pause = getPauseBetweenMoves();
    setTimeout(runWhatsappAnimation, duration + pause);
  };

  setTimeout(runWhatsappAnimation, 1500);

  window.addEventListener('resize', keepWhatsappInViewport);
}

const globalAuthState = {
  currentUser: null,
  initialized: false
};

function getFirebaseClient() {
  if (typeof window === 'undefined') return null;
  return window.inmoFirebase || null;
}

function dispatchAuthStateChanged() {
  document.dispatchEvent(new CustomEvent('inmo:auth-state-changed', {
    detail: {
      user: globalAuthState.currentUser,
      initialized: globalAuthState.initialized
    }
  }));
}

function renderNavbarAuthButton() {
  if (!mainNav) return;

  let actionButton = mainNav.querySelector('[data-nav-auth-action]');
  if (!actionButton) {
    actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'review-auth-btn review-auth-btn-outline nav-auth-action';
    actionButton.dataset.navAuthAction = 'true';
    mainNav.appendChild(actionButton);
  }

  if (globalAuthState.currentUser) {
    actionButton.textContent = 'Cerrar sesión';
    actionButton.onclick = async () => {
      const client = getFirebaseClient();
      if (!client?.auth) return;

      try {
        await client.auth.signOut();
      } catch (error) {
        console.error('No fue posible cerrar sesión.', error);
      }
    };
    return;
  }

  actionButton.textContent = 'Iniciar sesión';
  actionButton.onclick = async () => {
    const client = getFirebaseClient();
    if (!client?.auth || !client?.provider) return;

    try {
      await client.auth.signInWithPopup(client.provider);
    } catch (error) {
      console.error('No fue posible iniciar sesión con Google.', error);
    }
  };
}

function attachGlobalAuthListener() {
  const client = getFirebaseClient();
  if (!client?.enabled || !client?.auth) {
    globalAuthState.initialized = true;
    globalAuthState.currentUser = null;
    renderNavbarAuthButton();
    dispatchAuthStateChanged();
    return;
  }

  client.auth.onAuthStateChanged((user) => {
    globalAuthState.currentUser = user;
    globalAuthState.initialized = true;
    renderNavbarAuthButton();
    dispatchAuthStateChanged();
  });
}

window.inmoAuthState = globalAuthState;

if (window.inmoFirebase) {
  attachGlobalAuthListener();
} else {
  document.addEventListener('inmo:firebase-ready', attachGlobalAuthListener, { once: true });
}

initializeLucideIcons();
