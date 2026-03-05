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

function getRandomInterval() {
  return Math.floor(Math.random() * 3000) + 5000;
}

function moveWhatsappButton() {
  if (!whatsappFloat) return;

  const padding = 24;
  const maxX = window.innerWidth - whatsappFloat.offsetWidth - padding;
  const maxY = window.innerHeight - whatsappFloat.offsetHeight - padding;
  const minX = padding;
  const minY = padding;

  const nextX = Math.floor(Math.random() * Math.max(maxX - minX, 1)) + minX;
  const nextY = Math.floor(Math.random() * Math.max(maxY - minY, 1)) + minY;

  whatsappFloat.style.left = `${nextX}px`;
  whatsappFloat.style.top = `${nextY}px`;
}

if (whatsappFloat) {
  setTimeout(moveWhatsappButton, 1500);

  (function scheduleWhatsappMove() {
    const interval = getRandomInterval();
    setTimeout(() => {
      moveWhatsappButton();
      scheduleWhatsappMove();
    }, interval);
  })();

  window.addEventListener('resize', moveWhatsappButton);
}
