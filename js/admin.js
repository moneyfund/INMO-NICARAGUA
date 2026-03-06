const LOGIN_USER = "admin";
const LOGIN_PASS = "inm0nic2025";
const NICARAGUA_CENTER = [12.8654, -85.2072];
const DEFAULT_ZOOM = 7;
const SELECTED_ZOOM = 15;

const state = {
  properties: []
};

const form = document.getElementById("propertyForm");
const output = document.getElementById("jsonOutput");
const list = document.getElementById("propertyList");

const fields = {
  id: document.getElementById("propertyId"),
  title: document.getElementById("title"),
  price: document.getElementById("price"),
  city: document.getElementById("city"),
  address: document.getElementById("address"),
  bedrooms: document.getElementById("bedrooms"),
  bathrooms: document.getElementById("bathrooms"),
  size: document.getElementById("size"),
  type: document.getElementById("propertyType"),
  description: document.getElementById("description"),
  image: document.getElementById("image"),
  latitude: document.getElementById("latitude"),
  longitude: document.getElementById("longitude")
};

const preview = {
  image: document.getElementById("previewImage"),
  type: document.getElementById("previewType"),
  title: document.getElementById("previewTitle"),
  location: document.getElementById("previewLocation"),
  price: document.getElementById("previewPrice"),
  specs: document.getElementById("previewSpecs"),
  description: document.getElementById("previewDescription")
};

let locationMap;
let locationMarker;

function sanitizePrice(value) {
  if (typeof value === "number") return value;
  const clean = String(value).replace(/[^\d.-]/g, "");
  return Number(clean) || 0;
}

function getCoordinates(property = {}) {
  const latitude = Number(property.latitude ?? property.lat);
  const longitude = Number(property.longitude ?? property.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

function setCoordinates(latitude, longitude, shouldCenter = false) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

  fields.latitude.value = formatCoordinate(latitude);
  fields.longitude.value = formatCoordinate(longitude);

  if (!locationMap || typeof L === "undefined") return;

  if (!locationMarker) {
    locationMarker = L.marker([latitude, longitude], { draggable: true }).addTo(locationMap);
    locationMarker.on("dragend", (event) => {
      const point = event.target.getLatLng();
      setCoordinates(point.lat, point.lng);
    });
  } else {
    locationMarker.setLatLng([latitude, longitude]);
  }

  if (shouldCenter) {
    locationMap.setView([latitude, longitude], SELECTED_ZOOM);
  }
}

function initLocationMap() {
  if (typeof L === "undefined" || locationMap) return;
  const mapContainer = document.getElementById("locationMap");
  if (!mapContainer) return;

  locationMap = L.map(mapContainer, {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView(NICARAGUA_CENTER, DEFAULT_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(locationMap);

  locationMap.on("click", (event) => {
    setCoordinates(event.latlng.lat, event.latlng.lng);
  });
}

function refreshMapSize() {
  if (!locationMap) return;
  setTimeout(() => locationMap.invalidateSize(), 80);
}

function getNextId() {
  if (!state.properties.length) return 1;
  return Math.max(...state.properties.map((item) => Number(item.id) || 0)) + 1;
}

function buildPropertyFromForm(currentId) {
  const latitude = Number(fields.latitude.value || 0);
  const longitude = Number(fields.longitude.value || 0);

  return {
    id: currentId || getNextId(),
    titulo: fields.title.value.trim(),
    ubicacion: `${fields.city.value.trim()}, ${fields.address.value.trim()}`,
    tipo: fields.type.value,
    precio: sanitizePrice(fields.price.value),
    habitaciones: Number(fields.bedrooms.value || 0),
    banos: Number(fields.bathrooms.value || 0),
    area: Number(fields.size.value || 0),
    imagen: fields.image.value.trim(),
    descripcion: fields.description.value.trim(),
    latitude,
    longitude,
    lat: latitude,
    lng: longitude
  };
}

function fillForm(property) {
  fields.id.value = property.id;
  fields.title.value = property.titulo || "";
  const [city = "", ...addressParts] = String(property.ubicacion || "").split(",");
  fields.city.value = city.trim();
  fields.address.value = addressParts.join(",").trim();
  fields.type.value = property.tipo || "Casa";
  fields.price.value = property.precio ?? "";
  fields.bedrooms.value = property.habitaciones ?? 0;
  fields.bathrooms.value = property.banos ?? 0;
  fields.size.value = property.area ?? 0;
  fields.image.value = property.imagen || "";
  fields.description.value = property.descripcion || "";

  const coordinates = getCoordinates(property);
  if (coordinates) {
    setCoordinates(coordinates.latitude, coordinates.longitude, true);
  } else {
    fields.latitude.value = "";
    fields.longitude.value = "";
  }

  updatePreview();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function updatePreview() {
  preview.type.textContent = fields.type.value || "Tipo";
  preview.title.textContent = fields.title.value || "Título de propiedad";
  preview.location.textContent = `${fields.city.value || "Ciudad"} - ${fields.address.value || "Dirección"}`;
  preview.price.textContent = formatCurrency(sanitizePrice(fields.price.value));
  preview.specs.textContent = `${fields.bedrooms.value || 0} hab • ${fields.bathrooms.value || 0} baños • ${fields.size.value || 0} m²`;
  preview.description.textContent = fields.description.value || "Descripción de la propiedad...";
  preview.image.src = fields.image.value || "https://via.placeholder.com/600x380?text=Previsualizacion";
}

function refreshOutput() {
  output.textContent = JSON.stringify(state.properties, null, 2);
}

function renderList() {
  list.innerHTML = "";

  if (!state.properties.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No properties found in /data/propiedades.json.";
    row.appendChild(cell);
    list.appendChild(row);
    return;
  }

  state.properties
    .sort((a, b) => Number(a.id) - Number(b.id))
    .forEach((item) => {
      const row = document.createElement("tr");
      const [city = ""] = String(item.ubicacion || "").split(",");

      row.innerHTML = `
        <td>${item.id ?? ""}</td>
        <td>${item.titulo ?? ""}</td>
        <td>${city.trim()}</td>
        <td>${formatCurrency(sanitizePrice(item.precio))}</td>
        <td>${item.habitaciones ?? 0}</td>
        <td>${item.banos ?? 0}</td>
        <td><button type="button" class="edit-btn" data-id="${item.id}">EDIT</button></td>
      `;

      row.querySelector(".edit-btn").addEventListener("click", () => fillForm(item));
      list.appendChild(row);
    });
}

async function loadProperties() {
  try {
    const response = await fetch("data/propiedades.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo leer propiedades.json");
    const data = await response.json();
    state.properties = Array.isArray(data) ? data : [];
    renderList();
    refreshOutput();
  } catch (error) {
    state.properties = [];
    refreshOutput();
  }
}

function clearFormState() {
  form.reset();
  fields.id.value = "";
  fields.latitude.value = "";
  fields.longitude.value = "";

  if (locationMap) {
    locationMap.setView(NICARAGUA_CENTER, DEFAULT_ZOOM);
  }

  if (locationMarker) {
    locationMap.removeLayer(locationMarker);
    locationMarker = null;
  }

  updatePreview();
}

document.getElementById("addBtn").addEventListener("click", () => {
  if (!form.reportValidity()) return;
  const property = buildPropertyFromForm();
  state.properties.push(property);
  fields.id.value = property.id;
  renderList();
  refreshOutput();
});

document.getElementById("updateBtn").addEventListener("click", () => {
  if (!form.reportValidity()) return;
  const currentId = Number(fields.id.value);
  if (!currentId) {
    alert("Selecciona una propiedad primero desde la lista para actualizarla.");
    return;
  }

  const index = state.properties.findIndex((item) => Number(item.id) === currentId);
  if (index === -1) {
    alert("No se encontró la propiedad para actualizar.");
    return;
  }

  state.properties[index] = buildPropertyFromForm(currentId);
  renderList();
  refreshOutput();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  clearFormState();
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(output.textContent);
    alert("JSON copiado al portapapeles.");
  } catch (error) {
    alert("No se pudo copiar automáticamente. Copia manualmente el texto.");
  }
});

form.addEventListener("input", updatePreview);

const loginForm = document.getElementById("loginForm");
const loginScreen = document.getElementById("loginScreen");
const adminPanel = document.getElementById("adminPanel");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  if (user === LOGIN_USER && pass === LOGIN_PASS) {
    loginScreen.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    initLocationMap();
    refreshMapSize();
    await loadProperties();
    clearFormState();
    loginError.textContent = "";
    return;
  }

  loginError.textContent = "Credenciales incorrectas.";
  adminPanel.classList.add("hidden");
});

loadProperties();
