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

function applyTheme(theme) {
  const isDarkMode = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDarkMode);

  if (themeToggle) {
    themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro');
  }
}

applyTheme(savedTheme === 'dark' ? 'dark' : 'light');

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    localStorage.setItem('themeMode', nextTheme);
    applyTheme(nextTheme);
  });
}

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
