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

function renderSiteFooter() {
  const footerMarkup = `
    <div class="container footer-content">
      <nav class="footer-legal-nav" aria-label="Enlaces legales">
        ${footerLinks.map((link) => `<a class="footer-legal-link" href="${link.href}">${link.label}</a>`).join('')}
      </nav>
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
