import {
  auth,
  provider,
  db,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  orderBy,
  deleteField,
  serverTimestamp,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from './firebase-services.js';
import { uploadImage } from './storage-helpers.js';

const imageUtils = window.inmoImageUtils;

const state = {
  user: null,
  unsubscribeProperties: null,
  map: null,
  mapMarker: null,
  propertyImages: [],
  isSavingProperty: false,
  sharedSelectedPropertyIds: new Set(),
  sharedInventory: [],
  agentProfile: null,
  unsubscribeSharedLists: null
};

const fallbackPhoto = imageUtils?.PLACEHOLDER || 'assets/placeholder.svg';
const propertyUtils = window.inmoPropertyUtils || {};
const videoUtils = window.inmoVideoUtils || {};
const normalizePropertyType = (value = '') => propertyUtils.normalizePropertyType ? propertyUtils.normalizePropertyType(value) : String(value || '').trim().toLowerCase();
const getPropertyTypeLabel = (value = '') => propertyUtils.getPropertyTypeLabel ? propertyUtils.getPropertyTypeLabel(value) : value;
const formatDualPrice = (usd) => propertyUtils.formatDualPrice ? propertyUtils.formatDualPrice(usd) : `$${Number(usd || 0).toLocaleString()} USD`;
const calculatePricePerArea = (priceUsd, areaValue) => propertyUtils.calculatePricePerArea ? propertyUtils.calculatePricePerArea(priceUsd, areaValue) : NaN;
const formatPricePerArea = (value, unit) => propertyUtils.formatPricePerArea ? propertyUtils.formatPricePerArea(value, unit) : '';

function formatPropertyType(value = '') {
  return getPropertyTypeLabel(value);
}

function formatPropertyOperation(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const labels = {
    venta: 'Venta',
    alquiler: 'Alquiler'
  };
  return labels[normalized] || '';
}

function setMessage(message, type = 'info') {
  const box = document.getElementById('dashboardMessage');
  if (!box) return;
  box.textContent = message;
  box.dataset.type = type;
}

function authMarkup(user) {
  if (!user) return '<button type="button" id="googleLoginBtn">Ingresar con Google</button>';
  return `
    <div class="dashboard-user-chip">
      <img src="${user.photoURL || fallbackPhoto}" alt="${user.displayName || 'Agente'}">
      <span>${user.displayName || user.email || 'Agente'}</span>
      <button type="button" id="logoutBtn">Cerrar sesión</button>
    </div>
  `;
}

function getProfilePayload(user) {
  return {
    name: document.getElementById('agentName').value.trim() || user.displayName || 'Agente Diamantes Realty Group',
    photo: document.getElementById('agentPhoto').value.trim() || user.photoURL || fallbackPhoto,
    description: document.getElementById('agentDescription').value.trim(),
    email: document.getElementById('agentEmail').value.trim() || user.email || '',
    phone: document.getElementById('agentPhone').value.trim(),
    instagram: document.getElementById('agentInstagram').value.trim(),
    facebook: document.getElementById('agentFacebook').value.trim(),
    tiktok: document.getElementById('agentTiktok').value.trim(),
    whatsapp: document.getElementById('agentWhatsapp').value.trim(),
    updatedAt: serverTimestamp()
  };
}

function updateCoordinatesLabel(lat, lng) {
  const label = document.getElementById('propertyCoordinatesLabel');
  if (!label) return;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    label.textContent = 'Sin coordenadas seleccionadas.';
    return;
  }

  label.textContent = `Lat: ${lat.toFixed(6)} | Lng: ${lng.toFixed(6)}`;
}

function setPropertyCoordinates(lat, lng) {
  const latInput = document.getElementById('propertyLat');
  const lngInput = document.getElementById('propertyLng');

  if (!latInput || !lngInput) return;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    latInput.value = '';
    lngInput.value = '';
    updateCoordinatesLabel(NaN, NaN);
    return;
  }

  latInput.value = String(lat);
  lngInput.value = String(lng);
  updateCoordinatesLabel(lat, lng);
}

function setPropertyMapMarker(lat, lng) {
  if (!state.map || typeof L === 'undefined' || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const point = [lat, lng];
  if (!state.mapMarker) {
    state.mapMarker = L.marker(point).addTo(state.map);
  } else {
    state.mapMarker.setLatLng(point);
  }

  state.map.setView(point, 14);
}

function initPropertyLocationMap() {
  const mapElement = document.getElementById('propertyLocationMap');
  if (!mapElement || typeof L === 'undefined') return;

  const defaultPoint = [12.8654, -85.2072];
  state.map = L.map(mapElement).setView(defaultPoint, 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.map);

  state.map.on('click', (event) => {
    const { lat, lng } = event.latlng;
    setPropertyCoordinates(lat, lng);
    setPropertyMapMarker(lat, lng);
  });

  setPropertyCoordinates(NaN, NaN);
}

function createImageEntry({ url = '', file = null, source = 'url', status = 'ready', progress = 0, error = '' }) {
  return {
    id: crypto.randomUUID(),
    url: String(url || '').trim(),
    file,
    source,
    status,
    progress,
    error
  };
}

function setUploaderStatus(message = '') {
  const target = document.getElementById('propertyUploaderStatus');
  if (!target) return;
  target.textContent = message;
}

function getSelectedMode() {
  return document.querySelector('input[name="imageInputMode"]:checked')?.value || 'url';
}

function toggleImageInputMode() {
  const mode = getSelectedMode();
  const urlMode = document.getElementById('imageModeUrl');
  const uploadMode = document.getElementById('imageModeUpload');

  urlMode?.classList.toggle('hidden', mode !== 'url');
  uploadMode?.classList.toggle('hidden', mode !== 'upload');
}

function getCoverImageUrl() {
  const explicitCover = document.querySelector('input[name="propertyCoverImage"]:checked')?.value || '';
  const urls = state.propertyImages.filter((item) => item.url).map((item) => item.url);
  if (!urls.length) return '';
  return urls.includes(explicitCover) ? explicitCover : urls[0];
}

function refreshImageCounter() {
  const totalLabel = document.getElementById('propertyImagesCounter');
  if (!totalLabel) return;

  const uploaded = state.propertyImages.filter((item) => item.url).length;
  totalLabel.textContent = `${uploaded} imagen(es) listas`;
}

function renderImagePreview() {
  const container = document.getElementById('propertyImagesPreview');
  if (!container) return;

  refreshImageCounter();

  if (!state.propertyImages.length) {
    container.innerHTML = '<p class="empty-state uploader-empty">Agrega URLs o sube archivos para construir la galería.</p>';
    return;
  }

  const coverUrl = getCoverImageUrl();
  container.innerHTML = state.propertyImages.map((item, index) => {
    const previewSrc = item.url || (item.file ? URL.createObjectURL(item.file) : fallbackPhoto);
    const errorBadge = item.error ? `<small class="uploader-error">${item.error}</small>` : '';
    const progressBadge = item.status === 'uploading'
      ? `<small class="uploader-progress">Subiendo: ${Math.round(item.progress)}%</small>`
      : '';

    const sourceLabel = item.source === 'upload' ? 'Archivo' : 'URL manual';
    const uploadedClass = item.status === 'uploaded' || item.status === 'ready' ? 'is-uploaded' : '';
    const errorClass = item.error ? 'has-error' : '';

    return `
      <article class="image-preview-card ${uploadedClass} ${errorClass}">
        <img src="${previewSrc}" alt="Imagen ${index + 1}" loading="lazy" referrerpolicy="no-referrer">
        <div class="image-preview-meta">
          <strong>Imagen ${index + 1}</strong>
          <span>${item.url || item.file?.name || 'Pendiente de carga'}</span>
          <small>${sourceLabel}</small>
          ${progressBadge}
          ${errorBadge}
        </div>
        <div class="image-preview-actions">
          <button type="button" data-move-image="up" data-image-id="${item.id}" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-move-image="down" data-image-id="${item.id}" ${index === state.propertyImages.length - 1 ? 'disabled' : ''}>↓</button>
          <label class="cover-radio-label">
            <input type="radio" name="propertyCoverImage" value="${item.url}" ${item.url && item.url === coverUrl ? 'checked' : ''} ${!item.url ? 'disabled' : ''}>
            Portada
          </label>
          <button type="button" data-remove-image-id="${item.id}">Eliminar</button>
        </div>
      </article>
    `;
  }).join('');
}

function removeImageById(imageId) {
  state.propertyImages = state.propertyImages.filter((item) => item.id !== imageId);
  renderImagePreview();
}

function moveImage(imageId, direction) {
  const currentIndex = state.propertyImages.findIndex((item) => item.id === imageId);
  if (currentIndex < 0) return;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= state.propertyImages.length) return;

  const [moved] = state.propertyImages.splice(currentIndex, 1);
  state.propertyImages.splice(targetIndex, 0, moved);
  renderImagePreview();
}

function bindImagePreviewActions() {
  const container = document.getElementById('propertyImagesPreview');
  if (!container) return;

  container.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const removeId = button.dataset.removeImageId;
    if (removeId) {
      removeImageById(removeId);
      return;
    }

    const moveDirection = button.dataset.moveImage;
    const imageId = button.dataset.imageId;
    if (moveDirection && imageId) moveImage(imageId, moveDirection);
  });
}

function addUrlImage() {
  const input = document.getElementById('propertyImageUrlInput');
  if (!input) return;

  const value = input.value.trim();
  if (!value) {
    setUploaderStatus('Ingresa una URL antes de agregarla.');
    return;
  }

  if (!imageUtils?.isValidHttpUrl(value)) {
    setUploaderStatus('La URL ingresada no es válida. Usa una URL http(s) completa.');
    return;
  }

  if (state.propertyImages.some((item) => item.url === value)) {
    setUploaderStatus('Esa imagen ya existe en el listado.');
    return;
  }

  state.propertyImages.push(createImageEntry({ url: value, source: 'url', status: 'ready' }));
  input.value = '';
  setUploaderStatus('URL agregada correctamente.');
  renderImagePreview();
}

function fileFingerprint(file) {
  return [file.name, file.size, file.lastModified].join('::');
}

function handleFileSelection(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const validFiles = files.filter((file) => file.type.startsWith('image/'));
  if (!validFiles.length) {
    setUploaderStatus('Selecciona archivos de imagen válidos.');
    return;
  }

  const existing = new Set(
    state.propertyImages
      .filter((item) => item.file)
      .map((item) => fileFingerprint(item.file))
  );

  let added = 0;
  validFiles.forEach((file) => {
    const fingerprint = fileFingerprint(file);
    if (existing.has(fingerprint)) return;
    existing.add(fingerprint);
    added += 1;
    state.propertyImages.push(createImageEntry({ file, source: 'upload', status: 'pending' }));
  });

  if (!added) {
    setUploaderStatus('Los archivos seleccionados ya estaban en la lista.');
    event.target.value = '';
    return;
  }

  setUploaderStatus(`${added} archivo(s) listos para subir.`);
  event.target.value = '';
  renderImagePreview();
}

function getPropertyPayload(user, profileName, images, coverImage, videoData) {
  const lat = Number(document.getElementById('propertyLat').value);
  const lng = Number(document.getElementById('propertyLng').value);
  const title = document.getElementById('propertyTitle').value.trim();
  const price = Number(document.getElementById('propertyPrice').value || 0);
  const description = document.getElementById('propertyDescription').value.trim();
  const type = normalizePropertyType(document.getElementById('tipo-propiedad').value.trim());
  const areaValue = Number(document.getElementById('propertyArea').value || 0);
  const areaUnit = document.getElementById('propertyAreaUnit').value.trim();
  const pricePerAreaUsd = calculatePricePerArea(price, areaValue);

  const payload = {
    title,
    titulo: title,
    price,
    precio: price,
    descripcion: description,
    description,
    imagenes: images,
    images,
    coverImage,
    image: coverImage || images[0] || fallbackPhoto,
    imagen: coverImage || images[0] || fallbackPhoto,
    location: document.getElementById('propertyLocation').value.trim(),
    ubicacion: document.getElementById('propertyLocation').value.trim(),
    priceUsd: price,
    type,
    tipo: type,
    operation: document.getElementById('operacion-propiedad').value.trim(),
    operacion: document.getElementById('operacion-propiedad').value.trim(),
    tipoOperacion: document.getElementById('operacion-propiedad').value.trim(),
    bedrooms: Number(document.getElementById('propertyBedrooms').value || 0),
    habitaciones: Number(document.getElementById('propertyBedrooms').value || 0),
    bathrooms: Number(document.getElementById('propertyBathrooms').value || 0),
    banos: Number(document.getElementById('propertyBathrooms').value || 0),
    area: areaValue,
    areaValue,
    areaUnit,
    pricePerAreaUsd: Number.isFinite(pricePerAreaUsd) ? pricePerAreaUsd : null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    agenteId: user.uid,
    agentId: user.uid,
    agentName: profileName,
    status: 'available',
    updatedAt: serverTimestamp()
  };

  if (videoData) {
    payload.video = {
      type: videoData.type,
      url: videoData.url
    };
    payload.videoType = videoData.type;
    payload.videoUrl = videoData.url;
  }

  return payload;
}

function getPropertyDocRef(propertyId = '') {
  if (propertyId) return doc(db, 'properties', propertyId);
  return doc(collection(db, 'properties'));
}

async function uploadPropertyFile({ agentId, propertyId, imageItem }) {
  imageItem.status = 'uploading';
  imageItem.progress = 15;
  imageItem.error = '';
  renderImagePreview();

  try {
    const downloadURL = await uploadImage(imageItem.file, agentId, propertyId);
    imageItem.url = downloadURL;
    imageItem.status = 'uploaded';
    imageItem.progress = 100;
    imageItem.error = '';
    renderImagePreview();
    return downloadURL;
  } catch (error) {
    imageItem.status = 'error';
    imageItem.error = `Error de carga: ${error.message}`;
    imageItem.progress = 0;
    renderImagePreview();
    throw error;
  }
}

async function uploadPendingFiles(agentId, propertyId) {
  const pendingItems = state.propertyImages.filter((item) => item.source === 'upload' && item.file && !item.url);
  if (!pendingItems.length) return [];

  setUploaderStatus(`Subiendo ${pendingItems.length} archivo(s)...`);

  const uploadedUrls = [];
  for (const item of pendingItems) {
    const url = await uploadPropertyFile({ agentId, propertyId, imageItem: item });
    uploadedUrls.push(url);
  }

  setUploaderStatus('Archivos cargados correctamente.');
  return uploadedUrls;
}

function validateFinalImages() {
  const urls = state.propertyImages.map((item) => item.url).filter(Boolean);
  if (!urls.length) {
    throw new Error('Debes agregar al menos una imagen por URL o subida de archivo.');
  }

  const invalidUrls = urls.filter((url) => !imageUtils?.isValidHttpUrl(url));
  if (invalidUrls.length) {
    throw new Error(`Hay imágenes con URL inválida: ${invalidUrls.join(', ')}`);
  }

  return imageUtils.normalizeImageList(urls);
}

async function guardarPropiedad(data, propertyId = '') {
  if (!state.user) throw new Error('Sesión no válida.');

  const propertyRef = getPropertyDocRef(propertyId);

  if (propertyId) {
    const current = await getDoc(propertyRef);
    if (!current.exists() || current.data().agentId !== state.user.uid) {
      throw new Error('No tienes permisos para editar esta propiedad.');
    }
  }

  await uploadPendingFiles(state.user.uid, propertyRef.id);

  const images = validateFinalImages();
  const coverImage = (() => {
    const selected = getCoverImageUrl();
    return images.includes(selected) ? selected : images[0];
  })();

  const payload = getPropertyPayload(state.user, data.agentName, images, coverImage, data.videoData || null);
  const videoFields = data.videoData
    ? {}
    : (propertyId ? { video: deleteField(), videoType: deleteField(), videoUrl: deleteField() } : {});

  if (propertyId) {
    await updateDoc(propertyRef, {
      ...payload,
      ...videoFields
    });
    return propertyRef;
  }

  await setDoc(propertyRef, {
    ...payload,
    ...videoFields,
    createdAt: serverTimestamp()
  }, { merge: true });

  return propertyRef;
}

function resetPropertyForm() {
  document.getElementById('propertyForm').reset();
  document.getElementById('propertyDocId').value = '';
  state.propertyImages = [];
  setUploaderStatus('');
  setPropertyCoordinates(NaN, NaN);
  renderImagePreview();

  if (state.mapMarker && state.map) {
    state.map.removeLayer(state.mapMarker);
    state.mapMarker = null;
  }

  toggleImageInputMode();
  updatePricePerAreaPreview();
}

function fillPropertyForm(property) {
  document.getElementById('propertyDocId').value = property.id;
  document.getElementById('propertyTitle').value = property.title || property.titulo || '';
  document.getElementById('propertyPrice').value = property.price || property.precio || '';
  document.getElementById('propertyLocation').value = property.location || property.ubicacion || '';
  document.getElementById('propertyDescription').value = property.description || property.descripcion || '';
  document.getElementById('tipo-propiedad').value = normalizePropertyType(property.type || property.tipo || '');
  document.getElementById('operacion-propiedad').value = (property.tipoOperacion || property.operation || property.operacion || '').toLowerCase();
  document.getElementById('propertyBedrooms').value = property.bedrooms || property.habitaciones || 0;
  document.getElementById('propertyBathrooms').value = property.bathrooms || property.banos || 0;
  document.getElementById('propertyArea').value = property.areaValue || property.area || '';
  document.getElementById('propertyAreaUnit').value = (property.areaUnit || 'metros').toLowerCase();
  const propertyVideo = videoUtils.getPropertyVideoData ? videoUtils.getPropertyVideoData(property) : null;
  document.getElementById('propertyVideoType').value = propertyVideo?.type || '';
  document.getElementById('propertyVideoUrl').value = propertyVideo?.url || '';

  const normalizedImages = imageUtils.getPropertyImages(property);
  state.propertyImages = normalizedImages.map((url) => createImageEntry({ url, source: 'url', status: 'ready' }));
  renderImagePreview();

  const coverUrl = imageUtils.getCoverImage(property);
  const coverInput = document.querySelector(`input[name="propertyCoverImage"][value="${CSS.escape(coverUrl)}"]`);
  if (coverInput) coverInput.checked = true;

  const lat = Number(property.lat ?? property.latitude);
  const lng = Number(property.lng ?? property.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    setPropertyCoordinates(lat, lng);
    setPropertyMapMarker(lat, lng);
  } else {
    setPropertyCoordinates(NaN, NaN);
  }

  updatePricePerAreaPreview();
}

function propertyCard(property) {
  const statusLabel = String(property.status || 'available').toLowerCase() === 'sold' ? 'VENDIDA' : 'DISPONIBLE';
  const coverImage = imageUtils.getCoverImage(property);

  return `
    <article class="property-card">
      <img src="${coverImage}" alt="${property.title || property.titulo || 'Propiedad'}">
      <div class="property-card-content">
        <p class="badge">${formatPropertyType(property.type || property.tipo)} en ${String(formatPropertyOperation(property.tipoOperacion || property.operation || property.operacion) || 'Venta').toLowerCase()}</p>
        <h3>${property.title || property.titulo || 'Propiedad'}</h3>
        <p>${property.location || property.ubicacion || ''}</p>
        <p class="price">${formatDualPrice(property.priceUsd ?? property.price ?? property.precio)}</p>
        <p>${formatPricePerArea(property.pricePerAreaUsd ?? calculatePricePerArea(property.priceUsd ?? property.price ?? property.precio, property.areaValue ?? property.area), property.areaUnit)}</p>
        <p class="property-status-tag">${statusLabel}</p>
        <div class="agent-actions">
          <button type="button" data-edit-property="${property.id}">Editar</button>
          <button type="button" data-sold-property="${property.id}">Marcar vendida</button>
          <button type="button" data-delete-property="${property.id}">Eliminar</button>
        </div>
      </div>
    </article>
  `;
}

async function saveProfile(event) {
  event.preventDefault();
  if (!state.user) return;

  const payload = getProfilePayload(state.user);
  await setDoc(doc(db, 'agents', state.user.uid), payload, { merge: true });
  state.agentProfile = { ...(state.agentProfile || {}), ...payload };
  setMessage('Perfil actualizado correctamente.', 'success');
}

async function saveProperty(event) {
  event.preventDefault();
  if (!state.user || state.isSavingProperty) return;

  const submitButton = event.submitter || document.querySelector('#propertyForm button[type="submit"]');
  const profileName = document.getElementById('agentName').value.trim() || state.user.displayName || 'Agente';
  const propertyId = document.getElementById('propertyDocId').value;
  const propertyType = document.getElementById('tipo-propiedad')?.value.trim();
  const propertyOperation = document.getElementById('operacion-propiedad')?.value.trim();
  const propertyPrice = Number(document.getElementById('propertyPrice')?.value || 0);
  const areaValue = Number(document.getElementById('propertyArea')?.value || 0);
  const areaUnit = document.getElementById('propertyAreaUnit')?.value.trim();
  const videoType = document.getElementById('propertyVideoType')?.value || '';
  const videoUrl = document.getElementById('propertyVideoUrl')?.value || '';

  try {
    state.isSavingProperty = true;
    submitButton?.setAttribute('disabled', 'disabled');
    submitButton?.classList.add('is-loading');

    if (!propertyType) {
      throw new Error('Selecciona el tipo de propiedad antes de guardar.');
    }

    if (!propertyOperation) {
      throw new Error('Selecciona el tipo de operación antes de guardar.');
    }


    if (!Number.isFinite(propertyPrice) || propertyPrice <= 0) {
      throw new Error('Ingresa un precio válido mayor que 0 USD.');
    }

    if (!Number.isFinite(areaValue) || areaValue <= 0) {
      throw new Error('Ingresa un área válida mayor que 0.');
    }

    if (!areaUnit) {
      throw new Error('Selecciona la unidad de área de la propiedad.');
    }

    const videoValidation = videoUtils.validatePropertyVideoForm
      ? videoUtils.validatePropertyVideoForm({ type: videoType, url: videoUrl })
      : { valid: true, value: null };

    if (!videoValidation.valid) {
      throw new Error(videoValidation.message || 'El video configurado no es válido.');
    }

    setMessage('Guardando propiedad e imágenes...', 'info');

    await guardarPropiedad({
      agentName: profileName,
      videoData: videoValidation.value
    }, propertyId);

    setMessage(propertyId ? 'Propiedad actualizada correctamente.' : 'Propiedad creada correctamente.', 'success');
    resetPropertyForm();
  } catch (error) {
    console.error('[AgentDashboard] Error guardando propiedad.', error);
    setMessage(error.message || 'No fue posible guardar la propiedad.', 'error');
  } finally {
    state.isSavingProperty = false;
    submitButton?.removeAttribute('disabled');
    submitButton?.classList.remove('is-loading');
  }
}

async function markPropertyAsSold(propertyId) {
  if (!state.user || !propertyId) return;

  const refDoc = doc(db, 'properties', propertyId);
  const snapshot = await getDoc(refDoc);

  if (!snapshot.exists() || snapshot.data().agentId !== state.user.uid) {
    setMessage('No tienes permisos para modificar esta propiedad.', 'error');
    return;
  }

  await updateDoc(refDoc, { status: 'sold', updatedAt: serverTimestamp() });
  setMessage('Propiedad marcada como vendida.', 'success');
}

async function deleteProperty(propertyId) {
  if (!state.user || !propertyId) return;

  const refDoc = doc(db, 'properties', propertyId);
  const snapshot = await getDoc(refDoc);
  if (!snapshot.exists() || snapshot.data().agentId !== state.user.uid) {
    setMessage('No tienes permisos para eliminar esta propiedad.', 'error');
    return;
  }

  await deleteDoc(refDoc);
  setMessage('Propiedad eliminada.', 'success');
}

async function loadProfile(user) {
  const snapshot = await getDoc(doc(db, 'agents', user.uid));
  const profile = snapshot.exists() ? snapshot.data() : {};

  document.getElementById('agentName').value = profile.name || user.displayName || '';
  document.getElementById('agentPhoto').value = profile.photo || user.photoURL || '';
  document.getElementById('agentDescription').value = profile.description || '';
  document.getElementById('agentEmail').value = profile.email || user.email || '';
  document.getElementById('agentPhone').value = profile.phone || '';
  document.getElementById('agentInstagram').value = profile.instagram || '';
  document.getElementById('agentFacebook').value = profile.facebook || '';
  document.getElementById('agentTiktok').value = profile.tiktok || '';
  document.getElementById('agentWhatsapp').value = profile.whatsapp || '';
  state.agentProfile = profile;
}


function listenOwnProperties(user) {
  if (state.unsubscribeProperties) state.unsubscribeProperties();

  state.unsubscribeProperties = onSnapshot(query(collection(db, 'properties'), where('agentId', '==', user.uid)), (snapshot) => {
    const properties = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
    const list = document.getElementById('agentPropertiesList');
    const card = document.getElementById('agentPropertiesCard');

    card.classList.remove('hidden');
    list.innerHTML = properties.length
      ? properties.map(propertyCard).join('')
      : '<p class="empty-state">Todavía no tienes propiedades registradas.</p>';

    list.querySelectorAll('[data-edit-property]').forEach((button) => {
      button.addEventListener('click', () => {
        const selected = properties.find((property) => property.id === button.dataset.editProperty);
        if (selected) fillPropertyForm(selected);
      });
    });

    list.querySelectorAll('[data-sold-property]').forEach((button) => {
      button.addEventListener('click', () => markPropertyAsSold(button.dataset.soldProperty));
    });

    list.querySelectorAll('[data-delete-property]').forEach((button) => {
      button.addEventListener('click', () => deleteProperty(button.dataset.deleteProperty));
    });
  });
}


function normalizePropertyForShare(data = {}, id = '') {
  const title = data.title || data.titulo || 'Propiedad';
  const location = data.location || data.ubicacion || 'Ubicación no disponible';
  const type = normalizePropertyType(data.type || data.tipo || '');
  const operation = (data.operation || data.operacion || data.tipoOperacion || 'venta').toLowerCase();
  const price = Number(data.priceUsd ?? data.price ?? data.precio ?? 0);
  const status = String(data.status || 'available').toLowerCase();
  const bedrooms = Number(data.bedrooms ?? data.habitaciones ?? 0);
  const bathrooms = Number(data.bathrooms ?? data.banos ?? 0);
  const areaValue = Number(data.areaValue ?? data.area ?? 0);
  const areaUnit = data.areaUnit || 'metros';
  const coverImage = imageUtils.getCoverImage(data);

  return {
    id,
    ...data,
    title,
    location,
    type,
    operation,
    price,
    status,
    bedrooms,
    bathrooms,
    areaValue,
    areaUnit,
    coverImage
  };
}

function setSharedFeedback(message = '', type = 'info') {
  const node = document.getElementById('sharedListFeedback');
  if (!node) return;
  node.textContent = message;
  node.dataset.type = type;
}

function updateSharedCounter() {
  const counter = document.getElementById('sharedSelectedCounter');
  if (!counter) return;
  counter.textContent = `${state.sharedSelectedPropertyIds.size} propiedades seleccionadas`;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getSharedLink(token = '') {
  return `${window.location.origin}/share.html?token=${encodeURIComponent(token)}`;
}

function renderSharedInventory() {
  const list = document.getElementById('sharedInventoryList');
  const search = document.getElementById('sharedInventorySearch');
  if (!list) return;

  const term = String(search?.value || '').trim().toLowerCase();
  const filtered = state.sharedInventory.filter((property) => {
    if (!term) return true;
    return `${property.title} ${property.location}`.toLowerCase().includes(term);
  });

  if (!filtered.length) {
    list.innerHTML = '<p class="empty-state">No hay propiedades que coincidan con la búsqueda.</p>';
    return;
  }

  list.innerHTML = filtered.map((property) => {
    const checked = state.sharedSelectedPropertyIds.has(property.id) ? 'checked' : '';
    const statusLabel = property.status === 'sold' ? '<span class="property-status-tag">VENDIDA</span>' : '';
    const perArea = formatPricePerArea(calculatePricePerArea(property.price, property.areaValue), property.areaUnit);

    return `
      <article class="property-card shared-select-card">
        <label class="shared-select-checkbox">
          <input type="checkbox" data-share-property-id="${property.id}" ${checked}>
          <span>Seleccionar</span>
        </label>
        <img src="${property.coverImage || fallbackPhoto}" alt="${escapeHtml(property.title)}" loading="lazy">
        <div class="property-card-content">
          <p class="badge">${formatPropertyType(property.type)} en ${formatPropertyOperation(property.operation).toLowerCase()}</p>
          <h3>${escapeHtml(property.title)}</h3>
          <p>${escapeHtml(property.location)}</p>
          <p class="price">${formatDualPrice(property.price)}</p>
          <p>${perArea}</p>
          ${statusLabel}
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-share-property-id]').forEach((input) => {
    input.addEventListener('change', () => {
      const propertyId = input.dataset.sharePropertyId;
      if (!propertyId) return;

      if (input.checked) state.sharedSelectedPropertyIds.add(propertyId);
      else state.sharedSelectedPropertyIds.delete(propertyId);

      updateSharedCounter();
    });
  });
}

async function loadShareInventory() {
  if (!state.user) return;

  const snapshot = await getDocs(collection(db, 'properties'));
  const properties = snapshot.docs
    .map((item) => normalizePropertyForShare(item.data(), item.id))
    .filter((property) => property.status !== 'sold');

  state.sharedInventory = properties;
  renderSharedInventory();
}

function generateShareToken() {
  const randomBlock = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  return `share_${randomBlock}`;
}

async function createSharedList(event) {
  event.preventDefault();
  if (!state.user) return;

  if (!state.sharedSelectedPropertyIds.size) {
    setSharedFeedback('Debes seleccionar al menos una propiedad.', 'error');
    return;
  }

  const title = document.getElementById('sharedListTitle')?.value.trim();
  if (!title) {
    setSharedFeedback('El título de la lista es obligatorio.', 'error');
    return;
  }

  const profile = state.agentProfile || {};
  const whatsapp = profile.whatsapp || profile.phone || '';
  if (!whatsapp) {
    setSharedFeedback('Completa teléfono o WhatsApp en tu perfil para compartir listas.', 'error');
    return;
  }

  const sharedRef = doc(collection(db, 'sharedPropertyLists'));
  const token = generateShareToken();

  await setDoc(sharedRef, {
    token,
    title,
    createdByAgentId: state.user.uid,
    createdByAgentName: profile.name || state.user.displayName || 'Agente',
    createdByAgentPhone: profile.phone || '',
    createdByAgentPhoto: profile.photo || state.user.photoURL || fallbackPhoto,
    createdByAgentEmail: profile.email || state.user.email || '',
    createdByAgentWhatsapp: whatsapp,
    clientName: document.getElementById('sharedListClientName')?.value.trim() || '',
    propertyIds: Array.from(state.sharedSelectedPropertyIds),
    status: 'active',
    notes: document.getElementById('sharedListNotes')?.value.trim() || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  const sharedLink = getSharedLink(token);
  setSharedFeedback(`Lista creada. Link: ${sharedLink}`, 'success');
  try {
    await navigator.clipboard.writeText(sharedLink);
    setSharedFeedback('Lista creada y link copiado al portapapeles.', 'success');
  } catch (error) {
    // no-op when clipboard is unavailable
  }

  state.sharedSelectedPropertyIds.clear();
  document.getElementById('sharedListForm')?.reset();
  updateSharedCounter();
  renderSharedInventory();
}

function renderSharedHistory(items = []) {
  const container = document.getElementById('sharedListsHistory');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '<p class="empty-state">Todavía no has creado listas compartidas.</p>';
    return;
  }

  container.innerHTML = items.map((item) => {
    const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('es-NI') : 'Fecha pendiente';
    const total = Array.isArray(item.propertyIds) ? item.propertyIds.length : 0;
    const link = getSharedLink(item.token);
    const statusLabel = item.status === 'inactive' ? 'Inactiva' : 'Activa';

    return `
      <article class="shared-history-item">
        <div>
          <h4>${escapeHtml(item.title || 'Lista sin título')}</h4>
          <p>${date} · ${total} propiedades · ${statusLabel}</p>
        </div>
        <div class="shared-history-actions">
          <button type="button" data-share-copy="${item.token}">Copiar link</button>
          <button type="button" data-share-toggle="${item.id}" data-next-status="${item.status === 'active' ? 'inactive' : 'active'}">${item.status === 'active' ? 'Desactivar' : 'Activar'}</button>
          <button type="button" data-share-delete="${item.id}">Eliminar</button>
        </div>
        <p class="shared-link-preview">${link}</p>
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-share-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const token = button.dataset.shareCopy;
      if (!token) return;
      const link = getSharedLink(token);
      try {
        await navigator.clipboard.writeText(link);
        setSharedFeedback('Link copiado correctamente.', 'success');
      } catch (error) {
        setSharedFeedback(link, 'info');
      }
    });
  });

  container.querySelectorAll('[data-share-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      const listId = button.dataset.shareToggle;
      const nextStatus = button.dataset.nextStatus;
      if (!listId || !nextStatus) return;
      await updateDoc(doc(db, 'sharedPropertyLists', listId), { status: nextStatus, updatedAt: serverTimestamp() });
      setSharedFeedback(`Lista ${nextStatus === 'active' ? 'activada' : 'desactivada'} correctamente.`, 'success');
    });
  });

  container.querySelectorAll('[data-share-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const listId = button.dataset.shareDelete;
      if (!listId) return;
      await deleteDoc(doc(db, 'sharedPropertyLists', listId));
      setSharedFeedback('Lista eliminada.', 'success');
    });
  });
}

function listenOwnSharedLists(user) {
  if (state.unsubscribeSharedLists) state.unsubscribeSharedLists();

  const sharedQuery = query(
    collection(db, 'sharedPropertyLists'),
    where('createdByAgentId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );

  state.unsubscribeSharedLists = onSnapshot(sharedQuery, (snapshot) => {
    const lists = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    renderSharedHistory(lists);
  });
}

function bindSharedListModule() {
  document.getElementById('sharedListForm')?.addEventListener('submit', createSharedList);
  document.getElementById('sharedInventorySearch')?.addEventListener('input', renderSharedInventory);
  updateSharedCounter();
}

function updateLayoutForAuth(user) {
  const dashboard = document.getElementById('agentDashboard');
  if (dashboard) dashboard.classList.toggle('hidden', !user);
  document.getElementById('agentPropertiesCard')?.classList.toggle('hidden', !user);
  document.getElementById('sharedListsCard')?.classList.toggle('hidden', !user);
}


function bindAuthControls() {
  const authBox = document.getElementById('agentAuthBox');

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    authBox.innerHTML = authMarkup(user);
    updateLayoutForAuth(user);

    if (!user) {
      state.sharedInventory = [];
      state.sharedSelectedPropertyIds.clear();
      state.agentProfile = null;
      if (state.unsubscribeSharedLists) state.unsubscribeSharedLists();
      renderSharedInventory();
      renderSharedHistory([]);
      setMessage('Inicia sesión para administrar tu perfil y propiedades.', 'info');
      return;
    }

    await loadProfile(user);
    listenOwnProperties(user);
    listenOwnSharedLists(user);
    await loadShareInventory();
    setMessage('Sesión activa. Solo puedes editar tus propios datos.', 'success');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));
  });

  authBox.addEventListener('click', async (event) => {
    if (event.target.id !== 'googleLoginBtn') return;
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
      setMessage('No fue posible iniciar sesión con Google.', 'error');
    }
  });
}


function updatePricePerAreaPreview() {
  const dualPriceNode = document.getElementById('propertyDualPricePreview');
  const perAreaNode = document.getElementById('propertyPricePerAreaPreview');
  const price = Number(document.getElementById('propertyPrice')?.value || 0);
  const areaValue = Number(document.getElementById('propertyArea')?.value || 0);
  const areaUnit = document.getElementById('propertyAreaUnit')?.value || '';

  if (dualPriceNode) dualPriceNode.textContent = formatDualPrice(price);

  const value = calculatePricePerArea(price, areaValue);
  if (!perAreaNode) return;
  perAreaNode.textContent = formatPricePerArea(value, areaUnit);
}

function bindCalculatedFields() {
  ['propertyPrice', 'propertyArea', 'propertyAreaUnit'].forEach((fieldId) => {
    document.getElementById(fieldId)?.addEventListener('input', updatePricePerAreaPreview);
    document.getElementById(fieldId)?.addEventListener('change', updatePricePerAreaPreview);
  });
}

function bindImageControls() {
  document.querySelectorAll('input[name="imageInputMode"]').forEach((input) => {
    input.addEventListener('change', toggleImageInputMode);
  });

  document.getElementById('addImageUrlBtn')?.addEventListener('click', addUrlImage);
  document.getElementById('propertyImageUrlInput')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addUrlImage();
  });

  document.getElementById('propertyImageFiles')?.addEventListener('change', handleFileSelection);
}

function init() {
  document.getElementById('agentProfileForm')?.addEventListener('submit', saveProfile);
  document.getElementById('propertyForm')?.addEventListener('submit', saveProperty);
  document.getElementById('propertyFormReset')?.addEventListener('click', resetPropertyForm);
  initPropertyLocationMap();
  bindAuthControls();
  bindImageControls();
  bindSharedListModule();
  bindImagePreviewActions();
  bindCalculatedFields();
  toggleImageInputMode();
  renderImagePreview();
  updatePricePerAreaPreview();
}

window.addEventListener('DOMContentLoaded', init);
