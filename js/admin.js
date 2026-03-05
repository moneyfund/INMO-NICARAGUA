const LOGIN_USER = "admin";
const LOGIN_PASS = "inm0nic2025";

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
  lat: document.getElementById("lat"),
  lng: document.getElementById("lng")
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

function sanitizePrice(value) {
  if (typeof value === "number") return value;
  const clean = String(value).replace(/[^\d.-]/g, "");
  return Number(clean) || 0;
}

function getNextId() {
  if (!state.properties.length) return 1;
  return Math.max(...state.properties.map((item) => Number(item.id) || 0)) + 1;
}

function buildPropertyFromForm(currentId) {
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
    lat: Number(fields.lat.value || 0),
    lng: Number(fields.lng.value || 0)
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
  fields.lat.value = property.lat ?? "";
  fields.lng.value = property.lng ?? "";
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
  state.properties
    .sort((a, b) => Number(a.id) - Number(b.id))
    .forEach((item) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `#${item.id} - ${item.titulo}`;
      btn.addEventListener("click", () => fillForm(item));
      li.appendChild(btn);
      list.appendChild(li);
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
    await loadProperties();
    clearFormState();
    loginError.textContent = "";
    return;
  }

  loginError.textContent = "Credenciales incorrectas.";
  adminPanel.classList.add("hidden");
});
