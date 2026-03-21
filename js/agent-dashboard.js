import {
  auth,
  provider,
  db,
  storage,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from './firebase-services.js';

const state = {
  user: null,
  unsubscribeProperties: null,
  map: null,
  mapMarker: null,
  existingImages: [],
  pendingImages: [],
  imageUploads: []
};

const fallbackPhoto = 'assets/placeholder.svg';
const maxImageSize = 2 * 1024 * 1024;
const maxImages = 12;

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
    name: document.getElementById('agentName').value.trim() || user.displayName || 'Agente INMO NICARAGUA',
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

function createStoragePath(userId, fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
  return `propiedades/${userId}/${Date.now()}-${safeName}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function resetUploadsState() {
  state.pendingImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  state.pendingImages = [];
  state.imageUploads = [];
}

function resetPropertyForm() {
  document.getElementById('propertyForm').reset();
  document.getElementById('propertyDocId').value = '';
  setPropertyCoordinates(NaN, NaN);
  state.existingImages = [];
  resetUploadsState();
  renderImagePreview();

  if (state.mapMarker && state.map) {
    state.map.removeLayer(state.mapMarker);
    state.mapMarker = null;
  }
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

function getPropertyPayload(user, profileName, imagenes = state.existingImages.map((image) => image.url)) {
  const lat = Number(document.getElementById('propertyLat').value);
  const lng = Number(document.getElementById('propertyLng').value);
  const title = document.getElementById('propertyTitle').value.trim();
  const price = Number(document.getElementById('propertyPrice').value || 0);
  const description = document.getElementById('propertyDescription').value.trim();

  return {
    title,
    titulo: title,
    price,
    precio: price,
    descripcion: description,
    description,
    imagenes,
    images: imagenes,
    image: imagenes[0] || fallbackPhoto,
    video: document.getElementById('propertyVideo').value.trim(),
    location: document.getElementById('propertyLocation').value.trim(),
    ubicacion: document.getElementById('propertyLocation').value.trim(),
    type: document.getElementById('propertyType').value.trim(),
    tipo: document.getElementById('propertyType').value.trim(),
    bedrooms: Number(document.getElementById('propertyBedrooms').value || 0),
    habitaciones: Number(document.getElementById('propertyBedrooms').value || 0),
    bathrooms: Number(document.getElementById('propertyBathrooms').value || 0),
    banos: Number(document.getElementById('propertyBathrooms').value || 0),
    area: Number(document.getElementById('propertyArea').value || 0),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    agenteId: user.uid,
    agentId: user.uid,
    agentName: profileName,
    status: 'available',
    updatedAt: serverTimestamp()
  };
}

function renderImagePreview() {
  const container = document.getElementById('propertyImagesPreview');
  const hiddenInput = document.getElementById('propertyImagesData');
  const totalLabel = document.getElementById('propertyImagesCounter');
  if (!container || !hiddenInput || !totalLabel) return;

  const allUrls = [
    ...state.existingImages.map((image) => image.url),
    ...state.pendingImages.map((item) => item.previewUrl)
  ];

  hiddenInput.value = JSON.stringify(state.existingImages.map((image) => image.url));
  totalLabel.textContent = `${allUrls.length} imagen(es) seleccionada(s)`;

  if (!allUrls.length) {
    container.innerHTML = '<p class="empty-state uploader-empty">No has seleccionado imágenes todavía.</p>';
    return;
  }

  const existingMarkup = state.existingImages.map((image, index) => `
    <article class="image-preview-card is-uploaded">
      <img src="${image.url}" alt="Imagen subida ${index + 1}">
      <div class="image-preview-meta">
        <strong>Imagen guardada</strong>
        <span>Lista para publicar</span>
      </div>
      <div class="image-preview-actions">
        <button type="button" data-remove-existing-image="${image.path}">Eliminar</button>
      </div>
    </article>
  `).join('');

  const pendingMarkup = state.pendingImages.map((item) => `
    <article class="image-preview-card ${item.error ? 'has-error' : ''}">
      <img src="${item.previewUrl}" alt="${item.file.name}">
      <div class="image-preview-meta">
        <strong>${item.file.name}</strong>
        <span>${formatBytes(item.file.size)}</span>
      </div>
      <div class="upload-progress">
        <div class="upload-progress-bar" style="width:${item.progress || 0}%"></div>
      </div>
      <small>${item.error || (item.progress ? `${item.progress}% subido` : 'Pendiente de subir')}</small>
      <div class="image-preview-actions">
        <button type="button" data-remove-pending-image="${item.id}">Quitar</button>
      </div>
    </article>
  `).join('');

  container.innerHTML = existingMarkup + pendingMarkup;
}

function removePendingImage(imageId) {
  const selected = state.pendingImages.find((item) => item.id === imageId);
  if (selected) URL.revokeObjectURL(selected.previewUrl);
  state.pendingImages = state.pendingImages.filter((item) => item.id !== imageId);
  renderImagePreview();
}

async function removeExistingImageByPath(path) {
  if (!state.user) return;

  const image = state.existingImages.find((item) => item.path === path);
  if (!image) return;

  try {
    await deleteObject(ref(storage, path));
    state.existingImages = state.existingImages.filter((item) => item.path !== path);

    const propertyId = document.getElementById('propertyDocId').value;
    if (propertyId) {
      const imageUrls = state.existingImages.map((item) => item.url);
      await updateDoc(doc(db, 'properties', propertyId), {
        images: imageUrls,
        imagenes: imageUrls,
        image: imageUrls[0] || fallbackPhoto,
        updatedAt: serverTimestamp()
      });
    }

    renderImagePreview();
    setMessage('Imagen eliminada de Firebase Storage.', 'success');
  } catch (error) {
    console.error(error);
    setMessage('No fue posible eliminar la imagen subida.', 'error');
  }
}

function bindImagePreviewActions() {
  const container = document.getElementById('propertyImagesPreview');
  if (!container) return;

  container.addEventListener('click', (event) => {
    const pendingId = event.target.dataset.removePendingImage;
    const existingPath = event.target.dataset.removeExistingImage;

    if (pendingId) removePendingImage(pendingId);
    if (existingPath) removeExistingImageByPath(existingPath);
  });
}

function validateImageFile(file) {
  if (!file.type.startsWith('image/')) {
    return 'Solo se permiten archivos de imagen.';
  }

  return '';
}

async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  const imageUrl = URL.createObjectURL(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageUrl;
  });

  const maxDimension = 1600;
  let { width, height } = image;

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  URL.revokeObjectURL(imageUrl);

  if (!blob || blob.size >= file.size || blob.size > maxImageSize) return file;

  return new File([blob], file.name.replace(/\.(png|webp|jpeg)$/i, '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now()
  });
}

async function handleSelectedFiles(fileList) {
  const incomingFiles = Array.from(fileList || []);
  if (!incomingFiles.length) return;

  const availableSlots = maxImages - state.pendingImages.length - state.existingImages.length;
  if (availableSlots <= 0) {
    setMessage(`Solo puedes cargar hasta ${maxImages} imágenes por propiedad.`, 'error');
    return;
  }

  const slicedFiles = incomingFiles.slice(0, availableSlots);
  const errors = [];

  for (const file of slicedFiles) {
    const validationError = validateImageFile(file);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    const optimizedFile = await compressImage(file);
    if (optimizedFile.size > maxImageSize) {
      errors.push(`La imagen ${file.name} sigue superando el máximo de 2MB después de optimizar.`);
      continue;
    }

    state.pendingImages.push({
      id: crypto.randomUUID(),
      file: optimizedFile,
      originalName: file.name,
      previewUrl: URL.createObjectURL(optimizedFile),
      progress: 0,
      error: ''
    });
  }

  renderImagePreview();

  if (errors.length) {
    setMessage(errors.join(' '), 'error');
  } else {
    setMessage('Imágenes listas para subir.', 'success');
  }
}

function bindImagePicker() {
  const input = document.getElementById('propertyImagesInput');
  const dropzone = document.getElementById('propertyDropzone');
  if (!input || !dropzone) return;

  input.addEventListener('change', async (event) => {
    await handleSelectedFiles(event.target.files);
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragging');
    });
  });

  dropzone.addEventListener('drop', async (event) => {
    await handleSelectedFiles(event.dataTransfer.files);
  });

  dropzone.addEventListener('click', () => input.click());
}

async function subirImagen(file, onProgress = () => {}) {
  if (!state.user) throw new Error('Debes iniciar sesión para subir imágenes.');

  const path = createStoragePath(state.user.uid, file.name);
  const storageRef = ref(storage, path);

  const snapshot = await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
    task.on('state_changed', (current) => {
      const progress = Math.round((current.bytesTransferred / current.totalBytes) * 100);
      onProgress(progress);
    }, reject, () => resolve(task.snapshot));
  });

  const url = await getDownloadURL(snapshot.ref);
  return { url, path };
}

async function subirMultiplesImagenes(files) {
  const uploads = [];

  for (const image of files) {
    const uploaded = await subirImagen(image.file, (progress) => {
      image.progress = progress;
      renderImagePreview();
    });
    uploads.push(uploaded);
  }

  return uploads;
}

async function guardarPropiedad(data, imagenes, propertyId = '') {
  if (!state.user) throw new Error('Sesión no válida.');

  const payload = getPropertyPayload(state.user, data.agentName, imagenes);
  const propertiesCollection = collection(db, 'properties');

  if (propertyId) {
    const propertyRef = doc(db, 'properties', propertyId);
    const current = await getDoc(propertyRef);
    if (!current.exists() || current.data().agentId !== state.user.uid) {
      throw new Error('No tienes permisos para editar esta propiedad.');
    }
    await updateDoc(propertyRef, payload);
    return propertyRef;
  }

  return addDoc(propertiesCollection, {
    ...payload,
    createdAt: serverTimestamp()
  });
}

function fillPropertyForm(property) {
  document.getElementById('propertyDocId').value = property.id;
  document.getElementById('propertyTitle').value = property.title || property.titulo || '';
  document.getElementById('propertyPrice').value = property.price || property.precio || '';
  document.getElementById('propertyLocation').value = property.location || property.ubicacion || '';
  document.getElementById('propertyDescription').value = property.description || property.descripcion || '';
  document.getElementById('propertyType').value = property.type || property.tipo || '';
  document.getElementById('propertyBedrooms').value = property.bedrooms || property.habitaciones || 0;
  document.getElementById('propertyBathrooms').value = property.bathrooms || property.banos || 0;
  document.getElementById('propertyArea').value = property.area || 0;
  document.getElementById('propertyVideo').value = property.video || '';
  state.existingImages = (property.images || property.imagenes || []).map((url) => ({
    url,
    path: (() => {
      try {
        const decoded = decodeURIComponent(new URL(url).pathname);
        const marker = '/o/';
        const idx = decoded.indexOf(marker);
        return idx >= 0 ? decoded.slice(idx + marker.length) : '';
      } catch {
        return '';
      }
    })()
  }));
  resetUploadsState();
  renderImagePreview();

  const lat = Number(property.lat ?? property.latitude);
  const lng = Number(property.lng ?? property.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    setPropertyCoordinates(lat, lng);
    setPropertyMapMarker(lat, lng);
  } else {
    setPropertyCoordinates(NaN, NaN);
  }
}

function propertyCard(property) {
  const statusLabel = String(property.status || 'available').toLowerCase() === 'sold' ? 'VENDIDA' : 'DISPONIBLE';
  return `
    <article class="property-card">
      <img src="${property.image || property.images?.[0] || property.imagenes?.[0] || fallbackPhoto}" alt="${property.title || property.titulo || 'Propiedad'}">
      <div class="property-card-content">
        <h3>${property.title || property.titulo || 'Propiedad'}</h3>
        <p>${property.location || property.ubicacion || ''}</p>
        <p class="price">$${Number(property.price || property.precio || 0).toLocaleString()}</p>
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

  await setDoc(doc(db, 'agents', state.user.uid), getProfilePayload(state.user), { merge: true });
  setMessage('Perfil actualizado correctamente.', 'success');
}

async function saveProperty(event) {
  event.preventDefault();
  if (!state.user) return;

  const submitButton = event.submitter || document.querySelector('#propertyForm button[type="submit"]');
  const profileName = document.getElementById('agentName').value.trim() || state.user.displayName || 'Agente';
  const propertyId = document.getElementById('propertyDocId').value;

  try {
    submitButton?.setAttribute('disabled', 'disabled');
    submitButton?.classList.add('is-loading');
    setMessage('Subiendo imágenes y guardando propiedad...', 'info');

    const uploadedImages = await subirMultiplesImagenes(state.pendingImages);
    state.existingImages = [...state.existingImages, ...uploadedImages];

    const imageUrls = state.existingImages.map((image) => image.url);
    await guardarPropiedad({ agentName: profileName }, imageUrls, propertyId);

    setMessage(propertyId ? 'Propiedad actualizada correctamente.' : 'Propiedad creada correctamente.', 'success');
    resetPropertyForm();
  } catch (error) {
    console.error(error);
    setMessage(error.message || 'No fue posible guardar la propiedad.', 'error');
  } finally {
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

async function deletePropertyImages(property) {
  const images = property.images || property.imagenes || [];
  await Promise.all(images.map(async (url) => {
    try {
      const decoded = decodeURIComponent(new URL(url).pathname);
      const marker = '/o/';
      const idx = decoded.indexOf(marker);
      const path = idx >= 0 ? decoded.slice(idx + marker.length) : '';
      if (path) await deleteObject(ref(storage, path));
    } catch (error) {
      console.warn('No se pudo eliminar una imagen asociada.', error);
    }
  }));
}

async function deleteProperty(propertyId) {
  if (!state.user || !propertyId) return;

  const refDoc = doc(db, 'properties', propertyId);
  const snapshot = await getDoc(refDoc);
  if (!snapshot.exists() || snapshot.data().agentId !== state.user.uid) {
    setMessage('No tienes permisos para eliminar esta propiedad.', 'error');
    return;
  }

  await deletePropertyImages(snapshot.data());
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

function updateLayoutForAuth(user) {
  const dashboard = document.getElementById('agentDashboard');
  if (dashboard) dashboard.classList.toggle('hidden', !user);
  document.getElementById('agentPropertiesCard')?.classList.toggle('hidden', !user);
}

function bindAuthControls() {
  const authBox = document.getElementById('agentAuthBox');

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    authBox.innerHTML = authMarkup(user);
    updateLayoutForAuth(user);

    if (!user) {
      setMessage('Inicia sesión para administrar tu perfil y propiedades.', 'info');
      return;
    }

    await loadProfile(user);
    listenOwnProperties(user);
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

function init() {
  document.getElementById('agentProfileForm')?.addEventListener('submit', saveProfile);
  document.getElementById('propertyForm')?.addEventListener('submit', saveProperty);
  document.getElementById('propertyFormReset')?.addEventListener('click', resetPropertyForm);
  initPropertyLocationMap();
  bindAuthControls();
  bindImagePicker();
  bindImagePreviewActions();
  renderImagePreview();
}

window.addEventListener('DOMContentLoaded', init);
