import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
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
  initialized: false,
  unsubscribers: []
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

function renderShell() {
  const section = document.getElementById('propertyReviews');
  if (!section) return false;

  section.innerHTML = `
    <section class="pi-wrap" data-pi-wrap>
      <header class="pi-header">
        <div>
          <p class="pi-eyebrow">Interacciones</p>
          <h2>Comentarios, reseñas y me gusta</h2>
        </div>
        <div class="pi-auth" data-pi-auth></div>
      </header>

      <div class="pi-grid">
        <article class="pi-card" data-pi-likes>
          <div class="pi-card-head">
            <h3>Me gusta</h3>
            <p>Guarda tu reacción para esta propiedad.</p>
          </div>
          <button type="button" class="pi-like-btn" data-pi-like-btn>
            <span class="pi-like-icon" aria-hidden="true">❤</span>
            <span data-pi-like-label>Me gusta</span>
          </button>
          <p class="pi-like-count"><strong data-pi-like-count>0</strong> personas han dado me gusta.</p>
          <p class="pi-form-message" data-pi-like-message></p>
        </article>

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
      text: data.comment || data.review || data.content || '',
      rating: Math.max(0, Math.min(5, Number(data.rating || 0))),
      createdAt: data.createdAt || data.date || null,
      kind
    };
  });
}

function sortByDateDesc(items = []) {
  return [...items].sort((a, b) => {
    const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
    const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

function renderCommentList(comments = []) {
  const list = document.querySelector('[data-pi-comment-list]');
  if (!list) return;

  if (!comments.length) {
    list.innerHTML = '<p class="pi-empty">Aún no hay comentarios para esta propiedad.</p>';
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
    list.innerHTML = '<p class="pi-empty">Aún no hay reseñas para esta propiedad.</p>';
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

    button.addEventListener('click', () => {
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
      await addDoc(collection(db, 'reviews'), {
        propertyId: state.propertyId,
        userId: state.user.uid,
        userName: state.user.displayName || 'Usuario',
        userPhoto: state.user.photoURL || '',
        rating: state.reviewRating,
        comment: reviewText,
        review: reviewText,
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
      await addDoc(collection(db, 'comments'), {
        propertyId: state.propertyId,
        userId: state.user.uid,
        userName: state.user.displayName || 'Usuario',
        userPhoto: state.user.photoURL || '',
        comment: commentText,
        content: commentText,
        createdAt: serverTimestamp()
      });

      form.reset();
      setFormMessage('[data-pi-comment-form]', 'Comentario publicado correctamente.', 'is-success');
    } catch (error) {
      console.error('No se pudo publicar el comentario:', error);
      setFormMessage('[data-pi-comment-form]', 'No se pudo publicar el comentario. Inténtalo nuevamente.', 'is-error');
    }
  });
}

function bindLikes() {
  const button = document.querySelector('[data-pi-like-btn]');
  const count = document.querySelector('[data-pi-like-count]');
  const label = document.querySelector('[data-pi-like-label]');
  const message = document.querySelector('[data-pi-like-message]');
  if (!button || !count || !label || !message) return;

  let likesCache = [];

  const likesQuery = query(collection(db, 'likes'), where('propertyId', '==', state.propertyId));
  const unsubLikes = onSnapshot(likesQuery, (snapshot) => {
    likesCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    const total = likesCache.length;
    const isLiked = Boolean(state.user && likesCache.some((item) => item.userId === state.user.uid));

    count.textContent = String(total);
    button.classList.toggle('is-liked', isLiked);
    button.setAttribute('aria-pressed', String(isLiked));
    label.textContent = isLiked ? 'Te gusta esta propiedad' : 'Me gusta';
  }, (error) => {
    console.error('No se pudieron cargar los likes:', error);
    message.textContent = 'No se pudieron cargar los likes.';
  });

  state.unsubscribers.push(unsubLikes);

  button.addEventListener('click', async () => {
    if (!state.user) {
      message.textContent = 'Debes iniciar sesión para dar me gusta.';
      message.classList.remove('is-success');
      message.classList.add('is-error');
      return;
    }

    const likeId = `${state.propertyId}_${state.user.uid}`;
    const likeDoc = doc(db, 'likes', likeId);
    const alreadyLiked = likesCache.some((item) => item.userId === state.user.uid);

    button.disabled = true;
    try {
      if (alreadyLiked) {
        await deleteDoc(likeDoc);
        message.textContent = 'Quitaste tu me gusta.';
      } else {
        await setDoc(likeDoc, {
          propertyId: state.propertyId,
          userId: state.user.uid,
          userName: state.user.displayName || 'Usuario',
          userPhoto: state.user.photoURL || '',
          createdAt: serverTimestamp()
        });
        message.textContent = '¡Gracias por tu me gusta!';
      }
      message.classList.remove('is-error');
      message.classList.add('is-success');
    } catch (error) {
      console.error('No se pudo registrar el like:', error);
      message.textContent = 'No se pudo actualizar tu me gusta.';
      message.classList.remove('is-success');
      message.classList.add('is-error');
    } finally {
      button.disabled = false;
    }
  });
}

function subscribeComments() {
  const commentsQuery = query(collection(db, 'comments'), where('propertyId', '==', state.propertyId));
  const unsub = onSnapshot(commentsQuery, (snapshot) => {
    const comments = sortByDateDesc(normalizeItems(snapshot, 'comment'));
    renderCommentList(comments);
  }, (error) => {
    console.error('No se pudieron cargar los comentarios:', error);
  });

  state.unsubscribers.push(unsub);
}

function subscribeReviews() {
  const reviewsQuery = query(collection(db, 'reviews'), where('propertyId', '==', state.propertyId));
  const unsub = onSnapshot(reviewsQuery, (snapshot) => {
    const reviews = sortByDateDesc(normalizeItems(snapshot, 'review'));
    renderReviewList(reviews);
  }, (error) => {
    console.error('No se pudieron cargar las reseñas:', error);
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

async function initInteractionSystem() {
  const nextPropertyId = getPropertyIdFromUrl();
  if (!nextPropertyId) return;

  state.propertyId = nextPropertyId;

  if (!renderShell()) return;

  clearSubscriptions();
  state.reviewRating = 0;
  state.reviewHover = 0;

  bindCommentForm();
  bindReviewForm();
  bindLikes();
  subscribeComments();
  subscribeReviews();
  paintRatingPicker(0);

  if (!state.initialized) {
    onAuthStateChanged(auth, (user) => {
      state.user = user;
      renderAuthBox();
    });
    state.initialized = true;
  } else {
    renderAuthBox();
  }
}

function queueInit() {
  window.requestAnimationFrame(() => {
    initInteractionSystem().catch((error) => {
      console.error('No se pudo inicializar el sistema de interacciones:', error);
    });
  });
}

window.addEventListener('propertyDetailReady', queueInit);
window.addEventListener('DOMContentLoaded', queueInit);
window.addEventListener('beforeunload', clearSubscriptions);

const observer = new MutationObserver(() => {
  if (document.getElementById('propertyReviews')) queueInit();
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}
