import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  limit,
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCVL7tpUkyQWz_aVr9wFi2hrCBum2pLnPs',
  authDomain: 'inmo-nicaragua.firebaseapp.com',
  projectId: 'inmo-nicaragua',
  storageBucket: 'inmo-nicaragua.firebasestorage.app',
  messagingSenderId: '735319266898',
  appId: '1:735319266898:web:124c3b886d0eb32a25b18b',
  measurementId: 'G-DXTBSYNR95'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const state = {
  propertyId: '',
  user: null,
  reviewRating: 0,
  reviewHover: 0,
  authBound: false,
  unsubscribers: [],
  likesCache: [],
  isPublishingComment: false,
  isPublishingReview: false,
  initializedFor: '',
  initQueued: false
};

const LIST_STATE = {
  comments: {
    loading: 'Cargando comentarios...',
    empty: 'Aún no hay comentarios para esta propiedad.',
    error: 'No se pudieron cargar los comentarios en este momento.'
  },
  reviews: {
    loading: 'Cargando reseñas...',
    empty: 'Aún no hay reseñas para esta propiedad.',
    error: 'No se pudieron cargar las reseñas en este momento.'
  }
};

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

function setLikeMessage(text, type = '') {
  const element = document.querySelector('[data-pi-like-message]');
  if (!element) return;
  element.textContent = text;
  element.classList.remove('is-success', 'is-error');
  if (type) element.classList.add(type);
}

function updateFormsAvailability() {
  const commentForm = document.querySelector('[data-pi-comment-form]');
  const reviewForm = document.querySelector('[data-pi-review-form]');
  if (!commentForm || !reviewForm) return;

  const controls = [
    ...commentForm.querySelectorAll('textarea, button'),
    ...reviewForm.querySelectorAll('textarea, button')
  ];

  controls.forEach((control) => {
    if (control.dataset.piLogin) return;
    const isRateButton = control.matches('[data-pi-rate]');
    const busy = isRateButton ? state.isPublishingReview : (control.closest('[data-pi-review-form]') ? state.isPublishingReview : state.isPublishingComment);
    control.disabled = busy;
  });

  if (!state.user) {
    setFormMessage('[data-pi-comment-form]', 'Inicia sesión para publicar un comentario.', 'is-error');
    setFormMessage('[data-pi-review-form]', 'Inicia sesión para publicar una reseña.', 'is-error');
  } else {
    setFormMessage('[data-pi-comment-form]', '');
    setFormMessage('[data-pi-review-form]', '');
  }
}

function renderLikeShell() {
  const mount = document.getElementById('propertyLikeMount');
  if (!mount) return false;

  mount.innerHTML = `
    <div class="pi-like-top" data-pi-likes>
      <button type="button" class="pi-like-btn" data-pi-like-btn aria-pressed="false">
        <span class="pi-like-icon" aria-hidden="true">❤</span>
        <span data-pi-like-label>Me gusta</span>
      </button>
      <p class="pi-like-count"><strong data-pi-like-count>0</strong> me gusta</p>
      <p class="pi-form-message" data-pi-like-message></p>
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
        <article class="pi-card" data-pi-comments>
          <div class="pi-card-head">
            <h3>Comentarios</h3>
            <p>Comparte tu experiencia o una consulta rápida.</p>
          </div>
          <form data-pi-comment-form>
            <textarea name="comment" rows="4" maxlength="1200" placeholder="Escribe tu comentario..."></textarea>
            <button type="submit" class="pi-primary-btn">Publicar comentario</button>
            <p class="pi-form-message" data-pi-form-message></p>
          </form>
          <div class="pi-list" data-pi-comment-list>
            <p class="pi-empty">Aún no hay comentarios para esta propiedad.</p>
          </div>
        </article>

        <article class="pi-card" data-pi-reviews>
          <div class="pi-card-head">
            <h3>Reseñas</h3>
            <p>Califica y deja una opinión detallada.</p>
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

          <div class="pi-list" data-pi-review-list>
            <p class="pi-empty">Aún no hay reseñas para esta propiedad.</p>
          </div>
        </article>
      </div>
    </section>
  `;

  return true;
}

function renderAuthBox() {
  const box = document.querySelector('[data-pi-auth]');
  if (!box) return;

  if (!state.user) {
    box.innerHTML = '<button type="button" class="pi-primary-btn pi-login-btn" data-pi-login>Iniciar sesión con Google</button>';
    box.querySelector('[data-pi-login]')?.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error('No se pudo iniciar sesión con Google:', error);
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

function normalizeItems(snapshot, kind) {
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      propertyId: String(data.propertyId || '').trim(),
      userId: String(data.userId || '').trim(),
      userName: data.userName || data.authorName || 'Usuario',
      userPhoto: data.userPhoto || data.photoURL || '',
      commentText: String(data.comment || '').trim(),
      reviewText: String(data.review || '').trim(),
      text: data.comment || data.review || data.content || '',
      rating: Math.max(0, Math.min(5, Number(data.rating || 0))),
      createdAt: data.createdAt || data.date || null,
      kind
    };
  });
}

function splitInteractions(items = []) {
  const comments = [];
  const reviews = [];

  items.forEach((item) => {
    const hasComment = Boolean(item.commentText || item.text);
    const hasReview = Boolean(item.reviewText || item.text);
    const hasRating = Number(item.rating || 0) > 0;

    if (hasComment) {
      comments.push({
        ...item,
        text: item.commentText || item.text
      });
    }

    if (hasReview && hasRating) {
      reviews.push({
        ...item,
        text: item.reviewText || item.text
      });
    }
  });

  return {
    comments: sortByDateDesc(comments),
    reviews: sortByDateDesc(reviews)
  };
}

function sortByDateDesc(items = []) {
  return [...items].sort((a, b) => {
    const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
    const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

function getCacheKey(type) {
  return `pi-cache:${type}:${state.propertyId}`;
}

function writeListCache(type, items) {
  try {
    sessionStorage.setItem(getCacheKey(type), JSON.stringify({ updatedAt: Date.now(), items }));
  } catch (error) {
    console.warn(`No se pudo guardar cache de ${type}:`, error);
  }
}

function readListCache(type) {
  try {
    const raw = sessionStorage.getItem(getCacheKey(type));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const ageMs = Date.now() - Number(parsed?.updatedAt || 0);
    if (ageMs > 3 * 60 * 1000) return [];
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch (error) {
    console.warn(`No se pudo leer cache de ${type}:`, error);
    return [];
  }
}

function renderCommentList(comments = []) {
  const list = document.querySelector('[data-pi-comment-list]');
  if (!list) return;

  if (!comments.length) {
    list.innerHTML = `<p class="pi-empty">${LIST_STATE.comments.empty}</p>`;
    return;
  }

  list.innerHTML = comments.map((item) => {
    const userName = escapeHtml(item.userName || 'Usuario');
    const text = escapeHtml(item.text || '');
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

function renderReviewList(reviews = []) {
  const list = document.querySelector('[data-pi-review-list]');
  const avgStars = document.querySelector('[data-pi-average-stars]');
  const avgValue = document.querySelector('[data-pi-average-value]');
  const count = document.querySelector('[data-pi-review-count]');
  if (!list || !avgStars || !avgValue || !count) return;

  const total = reviews.length;
  const average = total
    ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / total
    : 0;

  avgStars.innerHTML = renderStars(Math.round(average));
  avgValue.textContent = average.toFixed(1);
  count.textContent = `${total} reseña${total === 1 ? '' : 's'}`;

  if (!reviews.length) {
    list.innerHTML = `<p class="pi-empty">${LIST_STATE.reviews.empty}</p>`;
    return;
  }

  list.innerHTML = reviews.map((item) => {
    const userName = escapeHtml(item.userName || 'Usuario');
    const text = escapeHtml(item.text || '');
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

function renderLikeState() {
  const button = document.querySelector('[data-pi-like-btn]');
  const count = document.querySelector('[data-pi-like-count]');
  const label = document.querySelector('[data-pi-like-label]');
  if (!button || !count || !label) return;

  const total = state.likesCache.length;
  const isLiked = Boolean(state.user && state.likesCache.some((item) => item.userId === state.user.uid));

  count.textContent = String(total);
  button.classList.toggle('is-liked', isLiked);
  button.setAttribute('aria-pressed', String(isLiked));
  label.textContent = isLiked ? 'Te gusta esta propiedad' : 'Me gusta';
}

function bindReviewForm() {
  const form = document.querySelector('[data-pi-review-form]');
  if (!form) return;

  const ratingButtons = form.querySelectorAll('[data-pi-rate]');
  ratingButtons.forEach((button) => {
    const value = Number(button.dataset.piRate || 0);

    button.addEventListener('mouseenter', () => {
      state.reviewHover = value;
      paintRatingPicker(state.reviewHover);
    });

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      state.reviewRating = value;
      paintRatingPicker(state.reviewRating);
    });

    button.addEventListener('click', () => {
      state.reviewRating = value;
      paintRatingPicker(state.reviewRating);
    });

    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      state.reviewRating = value;
      paintRatingPicker(state.reviewRating);
    });
  });

  form.querySelector('.pi-rating-picker')?.addEventListener('mouseleave', () => {
    state.reviewHover = 0;
    paintRatingPicker(state.reviewRating);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!state.user) {
      setFormMessage('[data-pi-review-form]', 'Debes iniciar sesión para publicar tu reseña.', 'is-error');
      return;
    }

    const reviewText = String(form.querySelector('textarea[name="review"]')?.value || '').trim();
    if (!state.reviewRating) {
      setFormMessage('[data-pi-review-form]', 'Selecciona una calificación de 1 a 5 estrellas.', 'is-error');
      return;
    }

    if (!reviewText) {
      setFormMessage('[data-pi-review-form]', 'Escribe una opinión para continuar.', 'is-error');
      return;
    }

    try {
      state.isPublishingReview = true;
      updateFormsAvailability();
      await addDoc(collection(db, 'reviews'), {
        propertyId: state.propertyId,
        userId: state.user.uid,
        userName: state.user.displayName || 'Usuario',
        userPhoto: state.user.photoURL || '',
        rating: state.reviewRating,
        comment: reviewText,
        review: reviewText,
        content: reviewText,
        createdAt: serverTimestamp()
      });

      form.reset();
      state.reviewRating = 0;
      state.reviewHover = 0;
      paintRatingPicker(0);
      setFormMessage('[data-pi-review-form]', 'Reseña publicada correctamente.', 'is-success');
    } catch (error) {
      console.error('No se pudo publicar la reseña:', error);
      setFormMessage('[data-pi-review-form]', 'No se pudo publicar la reseña. Inténtalo nuevamente.', 'is-error');
    } finally {
      state.isPublishingReview = false;
      updateFormsAvailability();
    }
  });
}

function bindCommentForm() {
  const form = document.querySelector('[data-pi-comment-form]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!state.user) {
      setFormMessage('[data-pi-comment-form]', 'Debes iniciar sesión para publicar un comentario.', 'is-error');
      return;
    }

    const commentText = String(form.querySelector('textarea[name="comment"]')?.value || '').trim();
    if (!commentText) {
      setFormMessage('[data-pi-comment-form]', 'Escribe un comentario para continuar.', 'is-error');
      return;
    }

    try {
      state.isPublishingComment = true;
      updateFormsAvailability();
      await addDoc(collection(db, 'reviews'), {
        propertyId: state.propertyId,
        userId: state.user.uid,
        userName: state.user.displayName || 'Usuario',
        userPhoto: state.user.photoURL || '',
        comment: commentText,
        review: '',
        rating: 0,
        content: commentText,
        createdAt: serverTimestamp()
      });

      form.reset();
      setFormMessage('[data-pi-comment-form]', 'Comentario publicado correctamente.', 'is-success');
    } catch (error) {
      console.error('No se pudo publicar el comentario:', error);
      setFormMessage('[data-pi-comment-form]', 'No se pudo publicar el comentario. Inténtalo nuevamente.', 'is-error');
    } finally {
      state.isPublishingComment = false;
      updateFormsAvailability();
    }
  });
}

function bindLikes() {
  const button = document.querySelector('[data-pi-like-btn]');
  if (!button) return;

  button.addEventListener('click', async () => {
    if (!state.user) {
      setLikeMessage('Debes iniciar sesión para dar me gusta.', 'is-error');
      return;
    }

    const likeId = `${state.propertyId}_${state.user.uid}`;
    const likeDoc = doc(db, 'likes', likeId);
    const alreadyLiked = state.likesCache.some((item) => item.userId === state.user.uid);

    button.disabled = true;
    try {
      if (alreadyLiked) {
        await deleteDoc(likeDoc);
        setLikeMessage('Quitaste tu me gusta.', 'is-success');
      } else {
        await setDoc(likeDoc, {
          propertyId: state.propertyId,
          userId: state.user.uid,
          userName: state.user.displayName || 'Usuario',
          userPhoto: state.user.photoURL || '',
          createdAt: serverTimestamp()
        });
        setLikeMessage('¡Gracias por tu me gusta!', 'is-success');
      }
    } catch (error) {
      console.error('No se pudo registrar el like:', error);
      setLikeMessage('No se pudo actualizar tu me gusta.', 'is-error');
    } finally {
      button.disabled = false;
    }
  });
}

function subscribeInteractions() {
  const reviewsQuery = query(
    collection(db, 'reviews'),
    where('propertyId', '==', state.propertyId),
    limit(80)
  );

  let resolvedFirstSnapshot = false;
  const loadingGuard = window.setTimeout(() => {
    if (resolvedFirstSnapshot) return;
    renderCommentsError('No se pudo completar la carga de comentarios. Recarga la página.');
    renderReviewsError('No se pudo completar la carga de reseñas. Recarga la página.');
  }, 10000);

  const unsub = onSnapshot(reviewsQuery, (snapshot) => {
    resolvedFirstSnapshot = true;
    window.clearTimeout(loadingGuard);
    const interactions = splitInteractions(normalizeItems(snapshot, 'interaction'));
    renderCommentList(interactions.comments);
    renderReviewList(interactions.reviews);
    writeListCache('comments', interactions.comments);
    writeListCache('reviews', interactions.reviews);
  }, (error) => {
    resolvedFirstSnapshot = true;
    window.clearTimeout(loadingGuard);
    console.error('No se pudieron cargar las interacciones:', error);
    renderCommentsError();
    renderReviewsError();
  });

  state.unsubscribers.push(() => {
    window.clearTimeout(loadingGuard);
    unsub();
  });
}

function subscribeLikes() {
  const likesQuery = query(
    collection(db, 'likes'),
    where('propertyId', '==', state.propertyId),
    limit(300)
  );
  const unsub = onSnapshot(likesQuery, (snapshot) => {
    state.likesCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    renderLikeState();
  }, (error) => {
    console.error('No se pudieron cargar los likes:', error);
    setLikeMessage('No se pudieron cargar los likes.', 'is-error');
  });

  state.unsubscribers.push(unsub);
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

function bindAuth() {
  if (state.authBound) return;

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    renderAuthBox();
    renderLikeState();
    updateFormsAvailability();
  });

  state.authBound = true;
}

function renderCommentsLoading() {
  const list = document.querySelector('[data-pi-comment-list]');
  if (!list) return;
  list.innerHTML = `<p class="pi-empty">${LIST_STATE.comments.loading}</p>`;
}

function renderReviewsLoading() {
  const list = document.querySelector('[data-pi-review-list]');
  if (!list) return;
  list.innerHTML = `<p class="pi-empty">${LIST_STATE.reviews.loading}</p>`;
}

function renderCommentsError(message = LIST_STATE.comments.error) {
  const list = document.querySelector('[data-pi-comment-list]');
  if (!list) return;
  list.innerHTML = `<p class="pi-empty">${escapeHtml(message)}</p>`;
}

function renderReviewsError(message = LIST_STATE.reviews.error) {
  const list = document.querySelector('[data-pi-review-list]');
  if (!list) return;
  list.innerHTML = `<p class="pi-empty">${escapeHtml(message)}</p>`;
}

async function initInteractionSystem(propertyIdFromEvent = '') {
  const propertyIdFromUrl = getPropertyIdFromUrl();
  const nextPropertyId = String(propertyIdFromEvent || propertyIdFromUrl || '').trim();
  if (!nextPropertyId) return;
  if (propertyIdFromEvent && propertyIdFromUrl && propertyIdFromEvent !== propertyIdFromUrl) {
    console.warn('Se detectó diferencia entre el propertyId del evento y la URL. Se usará el ID del evento.', {
      fromEvent: propertyIdFromEvent,
      fromUrl: propertyIdFromUrl
    });
  }

  state.propertyId = nextPropertyId;
  if (state.initializedFor === state.propertyId) return;
  state.reviewRating = 0;
  state.reviewHover = 0;
  state.likesCache = [];
  state.isPublishingComment = false;
  state.isPublishingReview = false;

  if (!renderLikeShell() || !renderDiscussionShell()) return;

  clearSubscriptions();
  bindAuth();
  bindCommentForm();
  bindReviewForm();
  bindLikes();

  paintRatingPicker(0);
  renderAuthBox();
  renderLikeState();
  updateFormsAvailability();

  const cachedComments = readListCache('comments');
  const cachedReviews = readListCache('reviews');
  if (cachedComments.length) renderCommentList(cachedComments); else renderCommentsLoading();
  if (cachedReviews.length) renderReviewList(cachedReviews); else renderReviewsLoading();

  await Promise.allSettled([
    Promise.resolve().then(() => {
      subscribeInteractions();
    })
  ]);

  subscribeLikes();
  state.initializedFor = state.propertyId;
}

function queueInit(event) {
  if (state.initQueued) return;
  state.initQueued = true;
  const propertyId = event?.detail?.propertyId || '';
  window.requestAnimationFrame(() => {
    initInteractionSystem(propertyId).catch((error) => {
      console.error('No se pudo inicializar el sistema de interacciones:', error);
    }).finally(() => {
      state.initQueued = false;
    });
  });
}

window.addEventListener('propertyDetailReady', queueInit);
window.addEventListener('DOMContentLoaded', queueInit);
window.addEventListener('beforeunload', clearSubscriptions);
