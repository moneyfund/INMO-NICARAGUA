import {
  db,
  auth,
  provider,
  collection,
  addDoc,
  query,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
  onAuthStateChanged,
  signInWithPopup
} from './firebase-services.js';

const MAX_ITEMS = 120;
const DEBUG_KEY = 'inmoDebugInteractions';

const state = {
  propertyId: '',
  user: null,
  authReady: false,
  initializedFor: '',
  reviewRating: 0,
  reviewHover: 0,
  comments: [],
  reviews: [],
  favoritesCount: 0,
  isFavorite: false,
  commentsStatus: 'idle',
  reviewsStatus: 'idle',
  favoritesStatus: 'idle',
  isSubmittingComment: false,
  isSubmittingReview: false,
  isSubmittingFavorite: false,
  authBound: false,
  unsubscribers: []
};

function isDebugEnabled() {
  const params = new URLSearchParams(window.location.search);
  return params.get('debugInteractions') === '1' || localStorage.getItem(DEBUG_KEY) === '1';
}

function debugLog(message, payload = {}) {
  if (!isDebugEnabled()) return;
  console.log(`[interactions] ${message}`, payload);
}

function getPropertyIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('id') || '').trim();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value) {
  const rawDate = value?.toDate ? value.toDate() : new Date(value || Date.now());
  if (Number.isNaN(rawDate.getTime())) return 'Fecha pendiente';
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(rawDate);
}

function getInitials(name = 'Usuario') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'U';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
}

function starSvg(filled = false) {
  return `<svg class="pi-star-icon ${filled ? 'is-filled' : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.6l2.63 5.32 5.87.85-4.25 4.14 1 5.84L12 17.03l-5.25 2.72 1-5.84L3.5 9.77l5.87-.85L12 3.6z"></path></svg>`;
}

function renderStars(rating = 0) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return Array.from({ length: 5 }, (_, index) => starSvg(index < safeRating)).join('');
}

function setFormMessage(formSelector, text, type = '') {
  const element = document.querySelector(`${formSelector} [data-pi-form-message]`);
  if (!element) return;
  element.textContent = text;
  element.classList.remove('is-success', 'is-error');
  if (type) element.classList.add(type);
}

function setFavoriteMessage(text, type = '') {
  const element = document.querySelector('[data-pi-favorite-message]');
  if (!element) return;
  element.textContent = text;
  element.classList.remove('is-success', 'is-error');
  if (type) element.classList.add(type);
}

function renderFavoriteShell() {
  const mount = document.getElementById('propertyLikeMount');
  if (!mount) return false;

  mount.innerHTML = `
    <div class="pi-like-top" data-pi-favorites>
      <button type="button" class="pi-like-btn" data-pi-favorite-btn aria-pressed="false">
        <span class="pi-like-icon" aria-hidden="true">❤</span>
        <span data-pi-favorite-label>Guardar en favoritos</span>
      </button>
      <p class="pi-like-count"><strong data-pi-favorite-count>0</strong> favoritos</p>
      <p class="pi-form-message" data-pi-favorite-message></p>
    </div>
  `;

  return true;
}

function renderDiscussionShell() {
  const section = document.getElementById('propertyReviews');
  if (!section) return false;

  section.innerHTML = `
    <section class="pi-wrap" data-pi-wrap>
      <header class="pi-header">
        <div>
          <p class="pi-eyebrow">Interacciones</p>
          <h2>Comentarios y reseñas</h2>
        </div>
        <div class="pi-auth" data-pi-auth></div>
      </header>

      <div class="pi-grid pi-grid-two">
        <article class="pi-card">
          <div class="pi-card-head">
            <h3>Comentarios</h3>
            <p>Comparte una consulta o experiencia sobre esta propiedad.</p>
          </div>
          <form data-pi-comment-form>
            <textarea name="comment" rows="4" maxlength="1200" placeholder="Escribe tu comentario..."></textarea>
            <button type="submit" class="pi-primary-btn">Publicar comentario</button>
            <p class="pi-form-message" data-pi-form-message></p>
          </form>
          <div class="pi-list" data-pi-comment-list></div>
        </article>

        <article class="pi-card">
          <div class="pi-card-head">
            <h3>Reseñas</h3>
            <p>Califica esta propiedad y comparte tu opinión.</p>
          </div>

          <div class="pi-summary">
            <div class="pi-stars" data-pi-average-stars>${renderStars(0)}</div>
            <p><strong data-pi-average-value>0.0</strong>/5</p>
            <p data-pi-review-count>0 reseñas</p>
          </div>

          <form data-pi-review-form>
            <div class="pi-rating-picker" role="radiogroup" aria-label="Selecciona una calificación">
              ${Array.from({ length: 5 }, (_, index) => `<button type="button" class="pi-rate-btn" data-pi-rate="${index + 1}" role="radio" aria-checked="false" aria-label="${index + 1} estrella${index ? 's' : ''}">${starSvg(false)}</button>`).join('')}
            </div>
            <p class="pi-rating-value">Calificación seleccionada: <strong data-pi-rating-value>0</strong>/5</p>
            <textarea name="review" rows="4" maxlength="1200" placeholder="Cuéntanos por qué das esta calificación..."></textarea>
            <button type="submit" class="pi-primary-btn">Publicar reseña</button>
            <p class="pi-form-message" data-pi-form-message></p>
          </form>

          <div class="pi-list" data-pi-review-list></div>
        </article>
      </div>
    </section>
  `;

  return true;
}

function renderAuthBox() {
  const box = document.querySelector('[data-pi-auth]');
  if (!box) return;

  if (!state.authReady) {
    box.innerHTML = '<span class="pi-empty">Verificando sesión...</span>';
    return;
  }

  if (!state.user) {
    box.innerHTML = '<button type="button" class="pi-primary-btn pi-login-btn" data-pi-login>Iniciar sesión con Google</button>';
    box.querySelector('[data-pi-login]')?.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error('No se pudo iniciar sesión con Google:', error);
        setFavoriteMessage('No se pudo iniciar sesión.', 'is-error');
      }
    });
    return;
  }

  const safeName = escapeHtml(state.user.displayName || 'Usuario');
  const photo = String(state.user.photoURL || '').trim();
  box.innerHTML = `
    <div class="pi-user-pill">
      ${photo ? `<img src="${escapeHtml(photo)}" alt="${safeName}" referrerpolicy="no-referrer">` : `<span class="pi-user-initial">${getInitials(safeName)}</span>`}
      <span>${safeName}</span>
    </div>
  `;
}

function renderCommentsState(message) {
  const list = document.querySelector('[data-pi-comment-list]');
  if (!list) return;
  list.innerHTML = `<p class="pi-empty">${escapeHtml(message)}</p>`;
}

function renderReviewsState(message) {
  const list = document.querySelector('[data-pi-review-list]');
  if (!list) return;
  list.innerHTML = `<p class="pi-empty">${escapeHtml(message)}</p>`;
}

function renderCommentList() {
  const comments = state.comments;
  const list = document.querySelector('[data-pi-comment-list]');
  if (!list) return;

  if (state.commentsStatus === 'loading') {
    renderCommentsState('Cargando comentarios...');
    return;
  }
  if (state.commentsStatus === 'error') {
    list.innerHTML = '<p class="pi-empty">No se pudieron cargar los comentarios. <button type="button" class="button-outline" data-pi-retry="comments">Reintentar</button></p>';
    list.querySelector('[data-pi-retry="comments"]')?.addEventListener('click', () => {
      restartSubscriptions();
    });
    return;
  }
  if (!comments.length) {
    renderCommentsState('Aún no hay comentarios para esta propiedad.');
    return;
  }

  list.innerHTML = comments.map((item) => {
    const userName = escapeHtml(item.userName || 'Usuario');
    const text = escapeHtml(item.comment || '');
    const photo = String(item.userPhoto || '').trim();
    const avatar = photo
      ? `<img src="${escapeHtml(photo)}" alt="${userName}" referrerpolicy="no-referrer">`
      : `<span class="pi-avatar-fallback">${getInitials(userName)}</span>`;

    return `
      <article class="pi-item">
        <div class="pi-item-head">
          <div class="pi-avatar">${avatar}</div>
          <div>
            <strong>${userName}</strong>
            <small>${formatDate(item.createdAt)}</small>
          </div>
        </div>
        <p>${text}</p>
      </article>
    `;
  }).join('');
}

function renderReviewList() {
  const reviews = state.reviews;
  const list = document.querySelector('[data-pi-review-list]');
  const avgStars = document.querySelector('[data-pi-average-stars]');
  const avgValue = document.querySelector('[data-pi-average-value]');
  const count = document.querySelector('[data-pi-review-count]');
  if (!list || !avgStars || !avgValue || !count) return;

  const total = reviews.length;
  const average = total ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / total : 0;
  avgStars.innerHTML = renderStars(Math.round(average));
  avgValue.textContent = average.toFixed(1);
  count.textContent = `${total} reseña${total === 1 ? '' : 's'}`;

  if (state.reviewsStatus === 'loading') {
    renderReviewsState('Cargando reseñas...');
    return;
  }
  if (state.reviewsStatus === 'error') {
    list.innerHTML = '<p class="pi-empty">No se pudieron cargar las reseñas. <button type="button" class="button-outline" data-pi-retry="reviews">Reintentar</button></p>';
    list.querySelector('[data-pi-retry="reviews"]')?.addEventListener('click', () => {
      restartSubscriptions();
    });
    return;
  }
  if (!reviews.length) {
    renderReviewsState('Aún no hay reseñas para esta propiedad.');
    return;
  }

  list.innerHTML = reviews.map((item) => {
    const userName = escapeHtml(item.userName || 'Usuario');
    const text = escapeHtml(item.comment || item.review || '');
    const photo = String(item.userPhoto || '').trim();
    const avatar = photo
      ? `<img src="${escapeHtml(photo)}" alt="${userName}" referrerpolicy="no-referrer">`
      : `<span class="pi-avatar-fallback">${getInitials(userName)}</span>`;

    return `
      <article class="pi-item">
        <div class="pi-item-head">
          <div class="pi-avatar">${avatar}</div>
          <div>
            <strong>${userName}</strong>
            <div class="pi-inline-stars">${renderStars(item.rating || 0)}</div>
            <small>${formatDate(item.createdAt)}</small>
          </div>
        </div>
        <p>${text}</p>
      </article>
    `;
  }).join('');
}

function renderFavoriteState() {
  const button = document.querySelector('[data-pi-favorite-btn]');
  const count = document.querySelector('[data-pi-favorite-count]');
  const label = document.querySelector('[data-pi-favorite-label]');
  if (!button || !count || !label) return;

  count.textContent = String(state.favoritesCount);
  button.classList.toggle('is-liked', state.isFavorite);
  button.setAttribute('aria-pressed', String(state.isFavorite));
  label.textContent = state.isFavorite ? 'En favoritos' : 'Guardar en favoritos';

  if (!state.authReady) {
    button.disabled = true;
    return;
  }

  button.disabled = state.isSubmittingFavorite || !state.user;
  if (!state.user) {
    setFavoriteMessage('Inicia sesión para guardar favoritos.');
  }
}

function paintRatingPicker(value = 0) {
  const activeValue = Math.max(0, Math.min(5, Number(value) || 0));
  document.querySelectorAll('[data-pi-rate]').forEach((btn) => {
    const current = Number(btn.dataset.piRate || 0);
    const isActive = current <= activeValue;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-checked', String(current === activeValue));
    btn.innerHTML = starSvg(isActive);
  });
  const valueEl = document.querySelector('[data-pi-rating-value]');
  if (valueEl) valueEl.textContent = String(activeValue);
}

function updateFormsAvailability() {
  const commentForm = document.querySelector('[data-pi-comment-form]');
  const reviewForm = document.querySelector('[data-pi-review-form]');
  if (!commentForm || !reviewForm) return;

  const commentControls = [...commentForm.querySelectorAll('textarea, button')];
  const reviewControls = [...reviewForm.querySelectorAll('textarea, button')];
  commentControls.forEach((control) => {
    const isButton = control.tagName === 'BUTTON';
    control.disabled = !state.authReady || state.isSubmittingComment || (isButton && !state.user);
  });
  reviewControls.forEach((control) => {
    const isButton = control.tagName === 'BUTTON';
    control.disabled = !state.authReady || state.isSubmittingReview || (isButton && !state.user);
  });
}

function normalizeSnapshot(snapshot) {
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      userId: String(data.userId || '').trim(),
      userName: data.userName || data.authorName || 'Usuario',
      userPhoto: data.userPhoto || '',
      comment: String(data.comment || '').trim(),
      review: String(data.review || '').trim(),
      rating: Math.max(0, Math.min(5, Number(data.rating || 0))),
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null
    };
  });
}

function clearSubscriptions() {
  state.unsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn('No se pudo cerrar una suscripción:', error);
    }
  });
  state.unsubscribers = [];
}

function subscribeComments() {
  state.commentsStatus = 'loading';
  renderCommentList();

  const commentsRef = collection(db, 'properties', state.propertyId, 'comments');
  const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'), limit(MAX_ITEMS));
  debugLog('Iniciando lectura de comentarios', { propertyId: state.propertyId });

  const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
    state.comments = normalizeSnapshot(snapshot);
    state.commentsStatus = 'success';
    debugLog('Comentarios cargados', { propertyId: state.propertyId, total: state.comments.length });
    renderCommentList();
  }, (error) => {
    state.comments = [];
    state.commentsStatus = 'error';
    console.error('No se pudieron cargar comentarios:', error);
    debugLog('Error leyendo comentarios', { propertyId: state.propertyId, error });
    renderCommentList();
  });

  state.unsubscribers.push(unsubscribe);
}

function subscribeReviews() {
  state.reviewsStatus = 'loading';
  renderReviewList();

  const reviewsRef = collection(db, 'properties', state.propertyId, 'reviews');
  const reviewsQuery = query(reviewsRef, orderBy('createdAt', 'desc'), limit(MAX_ITEMS));
  debugLog('Iniciando lectura de reseñas', { propertyId: state.propertyId });

  const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
    state.reviews = normalizeSnapshot(snapshot);
    state.reviewsStatus = 'success';
    debugLog('Reseñas cargadas', { propertyId: state.propertyId, total: state.reviews.length });
    renderReviewList();
  }, (error) => {
    state.reviews = [];
    state.reviewsStatus = 'error';
    console.error('No se pudieron cargar reseñas:', error);
    debugLog('Error leyendo reseñas', { propertyId: state.propertyId, error });
    renderReviewList();
  });

  state.unsubscribers.push(unsubscribe);
}

function subscribeFavorites() {
  state.favoritesStatus = 'loading';
  renderFavoriteState();

  const favoritesRef = collection(db, 'properties', state.propertyId, 'favorites');
  const favoritesQuery = query(favoritesRef, limit(1000));
  debugLog('Iniciando lectura de favoritos', { propertyId: state.propertyId });

  const unsubscribe = onSnapshot(favoritesQuery, (snapshot) => {
    const favorites = normalizeSnapshot(snapshot);
    state.favoritesCount = favorites.length;
    state.isFavorite = Boolean(state.user?.uid && favorites.some((entry) => entry.userId === state.user.uid));
    state.favoritesStatus = 'success';
    debugLog('Favoritos cargados', {
      propertyId: state.propertyId,
      total: state.favoritesCount,
      isFavorite: state.isFavorite
    });
    renderFavoriteState();
  }, (error) => {
    state.favoritesStatus = 'error';
    state.favoritesCount = 0;
    state.isFavorite = false;
    console.error('No se pudieron cargar favoritos:', error);
    debugLog('Error leyendo favoritos', { propertyId: state.propertyId, error });
    setFavoriteMessage('No se pudo cargar favoritos.', 'is-error');
    renderFavoriteState();
  });

  state.unsubscribers.push(unsubscribe);
}

function restartSubscriptions() {
  if (!state.propertyId) return;
  clearSubscriptions();
  subscribeComments();
  subscribeReviews();
  subscribeFavorites();
}

function bindCommentForm() {
  const form = document.querySelector('[data-pi-comment-form]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.user) {
      setFormMessage('[data-pi-comment-form]', 'Debes iniciar sesión para comentar.', 'is-error');
      return;
    }

    const comment = String(form.querySelector('textarea[name="comment"]')?.value || '').trim();
    if (!comment) {
      setFormMessage('[data-pi-comment-form]', 'Escribe un comentario para continuar.', 'is-error');
      return;
    }

    state.isSubmittingComment = true;
    updateFormsAvailability();
    debugLog('Guardando comentario', { propertyId: state.propertyId, userId: state.user.uid });

    try {
      await addDoc(collection(db, 'properties', state.propertyId, 'comments'), {
        propertyId: state.propertyId,
        userId: state.user.uid,
        userName: state.user.displayName || 'Usuario',
        userPhoto: state.user.photoURL || '',
        comment,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      form.reset();
      setFormMessage('[data-pi-comment-form]', 'Comentario publicado correctamente.', 'is-success');
    } catch (error) {
      console.error('No se pudo guardar comentario:', error);
      debugLog('Error guardando comentario', { propertyId: state.propertyId, error });
      setFormMessage('[data-pi-comment-form]', 'No se pudo publicar el comentario.', 'is-error');
    } finally {
      state.isSubmittingComment = false;
      updateFormsAvailability();
    }
  });
}

function bindReviewForm() {
  const form = document.querySelector('[data-pi-review-form]');
  if (!form) return;

  form.querySelectorAll('[data-pi-rate]').forEach((button) => {
    const value = Number(button.dataset.piRate || 0);
    button.addEventListener('click', () => {
      state.reviewRating = value;
      paintRatingPicker(state.reviewRating);
    });
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      state.reviewRating = value;
      paintRatingPicker(state.reviewRating);
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.user) {
      setFormMessage('[data-pi-review-form]', 'Debes iniciar sesión para publicar una reseña.', 'is-error');
      return;
    }

    const review = String(form.querySelector('textarea[name="review"]')?.value || '').trim();
    if (!state.reviewRating) {
      setFormMessage('[data-pi-review-form]', 'Selecciona de 1 a 5 estrellas.', 'is-error');
      return;
    }
    if (!review) {
      setFormMessage('[data-pi-review-form]', 'Escribe una reseña para continuar.', 'is-error');
      return;
    }

    state.isSubmittingReview = true;
    updateFormsAvailability();
    debugLog('Guardando reseña', { propertyId: state.propertyId, userId: state.user.uid, rating: state.reviewRating });

    try {
      await addDoc(collection(db, 'properties', state.propertyId, 'reviews'), {
        propertyId: state.propertyId,
        userId: state.user.uid,
        userName: state.user.displayName || 'Usuario',
        userPhoto: state.user.photoURL || '',
        rating: state.reviewRating,
        review,
        comment: review,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      form.reset();
      state.reviewRating = 0;
      paintRatingPicker(0);
      setFormMessage('[data-pi-review-form]', 'Reseña publicada correctamente.', 'is-success');
    } catch (error) {
      console.error('No se pudo guardar reseña:', error);
      debugLog('Error guardando reseña', { propertyId: state.propertyId, error });
      setFormMessage('[data-pi-review-form]', 'No se pudo publicar la reseña.', 'is-error');
    } finally {
      state.isSubmittingReview = false;
      updateFormsAvailability();
    }
  });
}

function bindFavoriteButton() {
  const button = document.querySelector('[data-pi-favorite-btn]');
  if (!button) return;

  button.addEventListener('click', async () => {
    if (!state.user) {
      setFavoriteMessage('Inicia sesión para guardar favoritos.', 'is-error');
      return;
    }
    if (state.isSubmittingFavorite || !state.propertyId) return;

    state.isSubmittingFavorite = true;
    renderFavoriteState();
    const favoriteRef = doc(db, 'properties', state.propertyId, 'favorites', state.user.uid);
    const nextValue = !state.isFavorite;
    state.isFavorite = nextValue;
    state.favoritesCount = Math.max(0, state.favoritesCount + (nextValue ? 1 : -1));
    renderFavoriteState();

    try {
      if (nextValue) {
        await setDoc(favoriteRef, {
          propertyId: state.propertyId,
          userId: state.user.uid,
          userName: state.user.displayName || 'Usuario',
          userPhoto: state.user.photoURL || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setFavoriteMessage('Propiedad agregada a favoritos.', 'is-success');
      } else {
        await deleteDoc(favoriteRef);
        setFavoriteMessage('Propiedad eliminada de favoritos.', 'is-success');
      }
    } catch (error) {
      console.error('No se pudo actualizar favorito:', error);
      debugLog('Error guardando favorito', { propertyId: state.propertyId, error });
      state.isFavorite = !nextValue;
      state.favoritesCount = Math.max(0, state.favoritesCount + (nextValue ? -1 : 1));
      setFavoriteMessage('No se pudo actualizar favorito.', 'is-error');
    } finally {
      state.isSubmittingFavorite = false;
      renderFavoriteState();
    }
  });
}

function bindAuth() {
  if (state.authBound) return;
  onAuthStateChanged(auth, (user) => {
    state.user = user;
    state.authReady = true;
    debugLog('Estado auth actualizado', { isLoggedIn: Boolean(user), userId: user?.uid || null });
    renderAuthBox();
    updateFormsAvailability();
    renderFavoriteState();
  });
  state.authBound = true;
}

async function initInteractionSystem(propertyIdFromEvent = '') {
  const fromUrl = getPropertyIdFromUrl();
  const propertyId = String(propertyIdFromEvent || fromUrl || '').trim();
  debugLog('Init solicitado', { propertyIdFromEvent, propertyIdFromUrl: fromUrl, resolvedPropertyId: propertyId });
  if (!propertyId) return;
  if (state.initializedFor === propertyId) return;

  state.propertyId = propertyId;
  state.initializedFor = propertyId;
  state.comments = [];
  state.reviews = [];
  state.favoritesCount = 0;
  state.isFavorite = false;
  state.commentsStatus = 'loading';
  state.reviewsStatus = 'loading';
  state.favoritesStatus = 'loading';
  state.reviewRating = 0;
  state.reviewHover = 0;

  if (!renderFavoriteShell() || !renderDiscussionShell()) return;

  clearSubscriptions();
  bindAuth();
  bindCommentForm();
  bindReviewForm();
  bindFavoriteButton();
  renderAuthBox();
  updateFormsAvailability();
  paintRatingPicker(0);
  renderCommentList();
  renderReviewList();
  renderFavoriteState();
  restartSubscriptions();
}

function queueInit(event) {
  const propertyId = event?.detail?.propertyId || '';
  window.requestAnimationFrame(() => {
    initInteractionSystem(propertyId).catch((error) => {
      console.error('No se pudo inicializar interacciones:', error);
      debugLog('Error de inicialización', { error });
    });
  });
}

window.addEventListener('propertyDetailReady', queueInit);
window.addEventListener('DOMContentLoaded', queueInit);
window.addEventListener('beforeunload', clearSubscriptions);
