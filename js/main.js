const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
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
