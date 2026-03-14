import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDocs,
  limit
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const REVIEW_COLLECTION = 'reviews';
const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 600;

const state = {
  selectedRating: 0,
  currentUser: null,
  unsubscribeReviews: null,
  authUnsubscribe: null,
  activePropertyId: null
};

function getPropertyIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const propertyId = urlParams.get('id');
  return propertyId ? String(propertyId).trim() : '';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function starString(rating = 0) {
  const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return Array.from({ length: 5 }, (_, index) => (index < safeRating ? '★' : '☆')).join(' ');
}

function formatDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function getInitials(name = 'Usuario') {
  return name
    .split(' ')
    .map((part) => part.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('');
}

function mountReviewSection(section) {
  section.innerHTML = `
    <style>
      .premium-reviews { border: 1px solid rgba(218, 165, 32, 0.25); border-radius: 20px; padding: 1.5rem; background: linear-gradient(160deg, rgba(255,255,255,0.96), rgba(250,246,237,0.96)); box-shadow: 0 14px 35px rgba(17, 24, 39, 0.08); }
      .premium-reviews__top { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
      .premium-reviews__metric { font-size: 1.05rem; font-weight: 600; color: #111827; }
      .premium-reviews__metric strong { font-size: 1.5rem; color: #b07f1f; }
      .premium-reviews__counter { color: #4b5563; font-weight: 500; }
      .premium-reviews__auth { color: #4b5563; font-size: 0.95rem; }
      .premium-reviews__auth button { border: 0; background: #111827; color: #fff; border-radius: 999px; padding: .55rem 1rem; cursor: pointer; }
      .premium-reviews__auth img { width: 36px; height: 36px; border-radius: 999px; object-fit: cover; }
      .premium-reviews__auth-user { display: flex; align-items: center; gap: .6rem; }
      .premium-reviews__stars { display: inline-flex; gap: .25rem; margin-bottom: .85rem; }
      .premium-reviews__stars button { border: 0; background: transparent; font-size: 1.55rem; color: #d1d5db; cursor: pointer; line-height: 1; padding: 0; }
      .premium-reviews__stars button.is-active { color: #f59e0b; transform: scale(1.08); }
      .premium-reviews textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 12px; padding: .75rem .8rem; resize: vertical; min-height: 96px; font-family: inherit; margin-bottom: .75rem; }
      .premium-reviews__submit { background: #b07f1f; color: #fff; border: 0; border-radius: 10px; font-weight: 600; padding: .65rem 1.1rem; cursor: pointer; }
      .premium-reviews__message { min-height: 1.3rem; font-size: .92rem; margin-top: .5rem; color: #374151; }
      .premium-reviews__message.is-error { color: #991b1b; }
      .premium-reviews__message.is-success { color: #065f46; }
      .premium-reviews__list { margin-top: 1.5rem; display: grid; gap: .85rem; }
      .premium-review-item { border: 1px solid #e5e7eb; border-radius: 14px; padding: .9rem; background: #fff; }
      .premium-review-item__header { display: flex; align-items: center; gap: .75rem; margin-bottom: .55rem; }
      .premium-review-item__avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; background: #f3f4f6; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; color: #374151; }
      .premium-review-item__name { margin: 0; font-weight: 700; color: #111827; }
      .premium-review-item__stars { margin: 0; color: #f59e0b; font-size: .98rem; }
      .premium-review-item__date { margin: 0; color: #6b7280; font-size: .82rem; }
      .premium-review-item__comment { margin: .3rem 0 0; color: #374151; }
      @media (max-width: 640px) {
        .premium-reviews { padding: 1rem; }
        .premium-reviews__metric strong { font-size: 1.3rem; }
      }
    </style>
    <div class="premium-reviews">
      <div class="premium-reviews__top">
        <div class="premium-reviews__metric">
          ⭐ <strong data-average-value>0.0</strong>
          <span class="premium-reviews__counter" data-review-count>(0 reseñas)</span>
        </div>
        <div class="premium-reviews__auth" data-auth-box></div>
      </div>

      <form id="premiumReviewForm" novalidate>
        <div class="premium-reviews__stars" aria-label="Calificación" data-stars-group>
          <button type="button" aria-label="1 estrella" data-star="1">★</button>
          <button type="button" aria-label="2 estrellas" data-star="2">★</button>
          <button type="button" aria-label="3 estrellas" data-star="3">★</button>
          <button type="button" aria-label="4 estrellas" data-star="4">★</button>
          <button type="button" aria-label="5 estrellas" data-star="5">★</button>
        </div>
        <textarea id="premiumReviewComment" maxlength="600" placeholder="Comparte tu experiencia con esta propiedad..."></textarea>
        <button class="premium-reviews__submit" type="submit">Enviar reseña</button>
        <p class="premium-reviews__message" data-form-message></p>
      </form>

      <div class="premium-reviews__list" data-reviews-list>
        <p>Aún no hay reseñas para esta propiedad.</p>
      </div>
    </div>
  `;
}

function setFormMessage(message, type = '') {
  const messageElement = document.querySelector('[data-form-message]');
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.classList.remove('is-error', 'is-success');
  if (type) messageElement.classList.add(type);
}

function paintStars(value) {
  document.querySelectorAll('[data-star]').forEach((starBtn) => {
    const isActive = Number(starBtn.dataset.star) <= value;
    starBtn.classList.toggle('is-active', isActive);
  });
}

function bindStarPicker() {
  const starsGroup = document.querySelector('[data-stars-group]');
  if (!starsGroup) return;

  starsGroup.querySelectorAll('[data-star]').forEach((button) => {
    button.addEventListener('mouseenter', () => paintStars(Number(button.dataset.star)));
    button.addEventListener('click', () => {
      state.selectedRating = Number(button.dataset.star);
      paintStars(state.selectedRating);
    });
  });

  starsGroup.addEventListener('mouseleave', () => paintStars(state.selectedRating));
}

function updateAuthUI() {
  const authBox = document.querySelector('[data-auth-box]');
  if (!authBox) return;

  if (!state.currentUser) {
    authBox.innerHTML = `
      <p>Debes iniciar sesión para dejar una reseña.</p>
      <button type="button" data-login-google>Iniciar sesión con Google</button>
    `;

    const loginButton = authBox.querySelector('[data-login-google]');
    if (loginButton) {
      loginButton.addEventListener('click', async () => {
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (error) {
          console.error('Error de autenticación con Google:', error);
          setFormMessage('No fue posible iniciar sesión.', 'is-error');
        }
      });
    }

    return;
  }

  const userName = escapeHtml(state.currentUser.displayName || 'Usuario');
  const photo = escapeHtml(state.currentUser.photoURL || '');

  authBox.innerHTML = `
    <div class="premium-reviews__auth-user">
      ${photo
        ? `<img src="${photo}" alt="${userName}" referrerpolicy="no-referrer">`
        : `<span class="premium-review-item__avatar">${getInitials(userName)}</span>`}
      <span>${userName}</span>
    </div>
  `;
}

function renderReviewList(reviews) {
  const list = document.querySelector('[data-reviews-list]');
  if (!list) return;

  if (!reviews.length) {
    list.innerHTML = '<p>Aún no hay reseñas para esta propiedad.</p>';
    return;
  }

  list.innerHTML = reviews.map((review) => {
    const name = escapeHtml(review.userName || 'Usuario');
    const photo = escapeHtml(review.userPhoto || '');
    const comment = escapeHtml(review.comment || '');
    const rating = Number(review.rating || 0);

    return `
      <article class="premium-review-item">
        <header class="premium-review-item__header">
          ${photo
            ? `<img class="premium-review-item__avatar" src="${photo}" alt="${name}" referrerpolicy="no-referrer">`
            : `<span class="premium-review-item__avatar">${getInitials(name)}</span>`}
          <div>
            <p class="premium-review-item__name">${name}</p>
            <p class="premium-review-item__stars">${starString(rating)}</p>
            <p class="premium-review-item__date">${formatDate(review.createdAt)}</p>
          </div>
        </header>
        <p class="premium-review-item__comment">${comment}</p>
      </article>
    `;
  }).join('');
}

function updateSummary(reviews) {
  const averageNode = document.querySelector('[data-average-value]');
  const countNode = document.querySelector('[data-review-count]');

  const total = reviews.length;
  const average = total
    ? reviews.reduce((acc, review) => acc + Number(review.rating || 0), 0) / total
    : 0;

  if (averageNode) averageNode.textContent = average.toFixed(1);
  if (countNode) countNode.textContent = `(${total} reseñas)`;
}

async function userAlreadyReviewed(propertyId, userId) {
  const existingReviewQuery = query(
    collection(db, REVIEW_COLLECTION),
    where('propertyId', '==', propertyId),
    where('userId', '==', userId),
    limit(1)
  );

  const snapshot = await getDocs(existingReviewQuery);
  return !snapshot.empty;
}

async function handleSubmit(event) {
  event.preventDefault();

  const propertyId = getPropertyIdFromUrl();
  const commentElement = document.getElementById('premiumReviewComment');
  const comment = commentElement ? commentElement.value.trim() : '';
  const rating = Number(state.selectedRating || 0);
  const user = state.currentUser;

  if (!propertyId) {
    console.error('No se encontró propertyId en la URL.');
    setFormMessage('No se encontró la propiedad.', 'is-error');
    return;
  }

  if (!user) {
    setFormMessage('Debes iniciar sesión para dejar una reseña.', 'is-error');
    return;
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    setFormMessage('Selecciona una calificación entre 1 y 5 estrellas.', 'is-error');
    return;
  }

  if (comment.length < MIN_COMMENT_LENGTH || comment.length > MAX_COMMENT_LENGTH) {
    setFormMessage(`El comentario debe tener entre ${MIN_COMMENT_LENGTH} y ${MAX_COMMENT_LENGTH} caracteres.`, 'is-error');
    return;
  }

  try {
    const hasReviewed = await userAlreadyReviewed(propertyId, user.uid);
    if (hasReviewed) {
      setFormMessage('Ya dejaste una reseña para esta propiedad.', 'is-error');
      return;
    }

    await addDoc(collection(db, REVIEW_COLLECTION), {
      propertyId,
      rating,
      comment,
      userId: user.uid,
      userName: user.displayName || 'Usuario',
      userPhoto: user.photoURL || '',
      createdAt: serverTimestamp()
    });

    event.target.reset();
    state.selectedRating = 0;
    paintStars(0);
    setFormMessage('Reseña enviada correctamente.', 'is-success');
  } catch (error) {
    console.error('Error al guardar la reseña en Firestore:', error);
    setFormMessage('No se pudo guardar la reseña. Inténtalo de nuevo.', 'is-error');
  }
}

function subscribeToPropertyReviews(propertyId) {
  if (state.unsubscribeReviews) state.unsubscribeReviews();

  try {
    const reviewsQuery = query(
      collection(db, REVIEW_COLLECTION),
      where('propertyId', '==', propertyId),
      orderBy('createdAt', 'desc')
    );

    state.unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
      const reviews = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
      updateSummary(reviews);
      renderReviewList(reviews);
    }, (error) => {
      console.error('Error al escuchar reseñas en tiempo real:', error);
      setFormMessage('No se pudieron cargar las reseñas en tiempo real.', 'is-error');
    });
  } catch (error) {
    console.error('Error al crear consulta de reseñas:', error);
    setFormMessage('No se pudo iniciar la sección de reseñas.', 'is-error');
  }
}

function initReviewSystem() {
  const section = document.getElementById('propertyReviews');
  if (!section) return;

  const propertyId = getPropertyIdFromUrl();
  if (!propertyId) {
    section.innerHTML = '<p>No se encontró un identificador de propiedad válido.</p>';
    console.error('Falta propertyId en la URL.');
    return;
  }

  if (state.activePropertyId === propertyId && document.getElementById('premiumReviewForm')) {
    return;
  }

  state.activePropertyId = propertyId;
  mountReviewSection(section);
  bindStarPicker();

  const form = document.getElementById('premiumReviewForm');
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }

  if (!state.authUnsubscribe) {
    state.authUnsubscribe = onAuthStateChanged(auth, (user) => {
      state.currentUser = user;
      updateAuthUI();
    }, (error) => {
      console.error('Error de estado de autenticación:', error);
      setFormMessage('No se pudo validar la autenticación.', 'is-error');
    });
  } else {
    updateAuthUI();
  }

  subscribeToPropertyReviews(propertyId);
}

window.addEventListener('propertyDetailReady', initReviewSystem);
window.addEventListener('DOMContentLoaded', initReviewSystem);
