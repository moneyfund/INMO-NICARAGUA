(async function () {
  const DATA_PATH = 'data/propiedades.json';

  async function loadProperties() {
    const response = await fetch(DATA_PATH);
    if (!response.ok) throw new Error('No se pudo cargar el catálogo.');
    return response.json();
  }

  function formatPrice(value, type) {
    const prefix = type === 'alquiler' ? 'US$/mes ' : 'US$ ';
    return `${prefix}${Number(value).toLocaleString('en-US')}`;
  }

  function propertyCard(property) {
    return `
      <article class="card">
        <img src="${property.imagen}" alt="${property.titulo}">
        <div class="card-content">
          <span class="badge">${property.tipo.toUpperCase()}</span>
          <h3>${property.titulo}</h3>
          <p class="meta">${property.ciudad} • ${property.habitaciones} hab • ${property.banos} baños</p>
          <p class="price">${formatPrice(property.precio, property.tipo)}</p>
          <a class="text-link" href="propiedad.html?id=${property.id}">Ver detalle</a>
        </div>
      </article>
    `;
  }

  function renderList(targetId, properties) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = properties.map(propertyCard).join('');
  }

  function initFilters(properties) {
    const typeFilter = document.getElementById('filterType');
    const cityFilter = document.getElementById('filterCity');
    const list = document.getElementById('propertiesList');
    if (!typeFilter || !cityFilter || !list) return;

    const cities = [...new Set(properties.map((item) => item.ciudad))];
    cityFilter.innerHTML += cities.map((city) => `<option value="${city}">${city}</option>`).join('');

    function applyFilters() {
      const selectedType = typeFilter.value;
      const selectedCity = cityFilter.value;
      const filtered = properties.filter((item) => {
        const typeMatch = selectedType === 'all' || item.tipo === selectedType;
        const cityMatch = selectedCity === 'all' || item.ciudad === selectedCity;
        return typeMatch && cityMatch;
      });
      renderList('propertiesList', filtered);
    }

    typeFilter.addEventListener('change', applyFilters);
    cityFilter.addEventListener('change', applyFilters);
    applyFilters();
  }

  function renderFeatured(properties) {
    const featured = properties.filter((item) => item.destacada).slice(0, 3);
    renderList('featuredProperties', featured);
  }

  function renderPropertyDetail(properties) {
    const detailContainer = document.getElementById('propertyDetail');
    if (!detailContainer) return;

    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('id'));
    const property = properties.find((item) => item.id === id) || properties[0];

    if (!property) {
      detailContainer.innerHTML = '<p>No se encontró la propiedad solicitada.</p>';
      return;
    }

    detailContainer.innerHTML = `
      <article class="property-detail">
        <img src="${property.imagen}" alt="${property.titulo}">
        <div>
          <span class="badge">${property.tipo.toUpperCase()}</span>
          <h1>${property.titulo}</h1>
          <p class="price">${formatPrice(property.precio, property.tipo)}</p>
          <p><strong>Ubicación:</strong> ${property.ciudad}</p>
          <p><strong>Habitaciones:</strong> ${property.habitaciones}</p>
          <p><strong>Baños:</strong> ${property.banos}</p>
          <p>${property.descripcion}</p>
          <a href="propiedades.html" class="btn btn-primary">Volver al catálogo</a>
        </div>
      </article>
    `;
  }

  try {
    const properties = await loadProperties();
    renderFeatured(properties);
    initFilters(properties);
    renderPropertyDetail(properties);
  } catch (error) {
    ['featuredProperties', 'propertiesList', 'propertyDetail'].forEach((id) => {
      const target = document.getElementById(id);
      if (target) target.innerHTML = `<p>${error.message}</p>`;
    });
  }
})();
