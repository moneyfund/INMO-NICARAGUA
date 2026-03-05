let allProperties = [];

async function loadProperties() {
  const response = await fetch('data/propiedades.json');
  allProperties = await response.json();
  return allProperties;
}

function propertyCardTemplate(property) {
  return `
    <article class="property-card">
      <img src="${property.imagen}" alt="${property.titulo}">
      <div class="property-card-content">
        <p class="badge">${property.tipo}</p>
        <h3>${property.titulo}</h3>
        <p>${property.ubicacion}</p>
        <p class="price">$${property.precio.toLocaleString()}</p>
        <div class="property-meta">
          <span>${property.habitaciones} hab.</span>
          <span>${property.banos} baños</span>
          <span>${property.area} m²</span>
        </div>
        <p><a class="text-link" href="propiedad.html?id=${property.id}">Ver detalle</a></p>
      </div>
    </article>
  `;
}

function renderFeatured(properties) {
  const featuredGrid = document.getElementById('featuredGrid');
  if (!featuredGrid) return;
  featuredGrid.innerHTML = properties.slice(0, 3).map(propertyCardTemplate).join('');
  applyCardRevealAnimation(featuredGrid);
}

function renderPropertyList(properties) {
  const grid = document.getElementById('propertiesGrid');
  const emptyState = document.getElementById('emptyState');
  if (!grid) return;

  grid.innerHTML = properties.map(propertyCardTemplate).join('');
  if (emptyState) emptyState.classList.toggle('hidden', properties.length !== 0);
  applyCardRevealAnimation(grid);
}

function applyCardRevealAnimation(container) {
  const cards = container.querySelectorAll('.property-card');
  if (!cards.length) return;

  cards.forEach((card) => {
    card.classList.add('reveal-on-scroll');
  });

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

  cards.forEach((card) => observer.observe(card));
}

function getInitialFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    ubicacion: params.get('ubicacion') || '',
    tipo: params.get('tipo') || ''
  };
}

function applyFilters(properties) {
  const locationInput = document.getElementById('filterLocation')?.value.trim().toLowerCase() || '';
  const typeInput = document.getElementById('filterType')?.value || '';
  const budgetInput = Number(document.getElementById('filterBudget')?.value || 0);

  return properties.filter((property) => {
    const matchesLocation = !locationInput || property.ubicacion.toLowerCase().includes(locationInput);
    const matchesType = !typeInput || property.tipo === typeInput;
    const matchesBudget = !budgetInput || property.precio <= budgetInput;
    return matchesLocation && matchesType && matchesBudget;
  });
}

function renderPropertyDetail(properties) {
  const detailContainer = document.getElementById('propertyDetail');
  if (!detailContainer) return;

  const params = new URLSearchParams(window.location.search);
  const propertyId = Number(params.get('id'));
  const property = properties.find((item) => item.id === propertyId);

  if (!property) {
    detailContainer.innerHTML = '<p>Propiedad no encontrada. <a href="propiedades.html" class="text-link">Regresar al catálogo</a></p>';
    return;
  }

  detailContainer.innerHTML = `
    <div class="detail-grid">
      <img src="${property.imagen}" alt="${property.titulo}">
      <div>
        <p class="badge">${property.tipo}</p>
        <h1>${property.titulo}</h1>
        <p>${property.ubicacion}</p>
        <p class="price">$${property.precio.toLocaleString()}</p>
        <p>${property.descripcion}</p>
        <ul class="checklist">
          <li>${property.habitaciones} habitaciones</li>
          <li>${property.banos} baños</li>
          <li>${property.area} m² de construcción</li>
        </ul>
        <a class="button-outline" href="contacto.html">Solicitar visita privada</a>
      </div>
    </div>
  `;
}

(async function initProperties() {
  try {
    const properties = await loadProperties();
    renderFeatured(properties);

    const filterForm = document.getElementById('filterForm');
    if (filterForm) {
      const initial = getInitialFilters();
      const filterLocation = document.getElementById('filterLocation');
      const filterType = document.getElementById('filterType');

      if (filterLocation) filterLocation.value = initial.ubicacion;
      if (filterType) filterType.value = initial.tipo;

      renderPropertyList(applyFilters(properties));
      filterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        renderPropertyList(applyFilters(properties));
      });
    }

    renderPropertyDetail(properties);
  } catch (error) {
    const targets = ['featuredGrid', 'propertiesGrid', 'propertyDetail'];
    targets.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.innerHTML = '<p>No pudimos cargar la información de propiedades. Intenta nuevamente.</p>';
      }
    });
  }
})();
