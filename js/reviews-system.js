import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp
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
  rating: 0
};

function getPropertyIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('id') || '').trim();
}

function sanitize(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stars(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return Array.from({ length: 5 }, (_, index) => (index < safeRating ? '★' : '☆')).join(' ');
}

function formatDate(createdAt) {
  const date = createdAt?.toDate ? createdAt.toDate() : null;
  if (!date) return 'Fecha pendiente';
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function setMessage(message, type = '') {
  const messageNode = document.querySelector('[data-new-review-message]');
  if (!messageNode) return;
  messageNode.textContent = message;
  messageNode.classList.remove('is-error', 'is-success');
  if (type) messageNode.classList.add(type);
}

function renderShell() {
  const section = document.getElementById('propertyReviews');
  if (!section) return false;

  section.innerHTML = `
    <div class="property-reviews-header">
      <h2>Opiniones de la propiedad</h2>
      <div class="reviews-auth-controls" data-new-auth-box></div>
    </div>
    <div class="reviews-summary" data-new-reviews-summary>
      <p class="reviews-stars" data-new-average-stars>☆ ☆ ☆ ☆ ☆</p>
      <p class="reviews-average" data-new-average-value>0.0 / 5</p>
      <p class="reviews-count" data-new-review-count>(0 reseñas)</p>
    </div>
    <form class="review-form" data-new-review-form>
      <div class="review-form-stars" aria-label="Calificación de estrellas">
        <button type="button" data-new-star="1" aria-label="1 estrella">★</button>
        <button type="button" data-new-star="2" aria-label="2 estrellas">★</button>
        <button type="button" data-new-star="3" aria-label="3 estrellas">★</button>
        <button type="button" data-new-star="4" aria-label="4 estrellas">★</button>
        <button type="button" data-new-star="5" aria-label="5 estrellas">★</button>
      </div>
      <textarea name="comment" rows="4" maxlength="600" placeholder="Comparte tu opinión sobre esta propiedad..."></textarea>
      <button type="submit">Enviar reseña</button>
      <p class="review-form-message" data-new-review-message></p>
    </form>
    <div class="reviews-list" data-new-reviews-list>
      <p class="reviews-empty">Aún no hay opiniones para esta propiedad.</p>
    </div>
  `;

  return true;
}

function refreshStarSelection() {
  document.querySelectorAll('[data-new-star]').forEach((starButton) => {
    const starValue = Number(starButton.dataset.newStar || 0);
    starButton.classList.toggle('active', starValue <= state.rating);
  });
}

function renderAuthBox() {
  const authBox = document.querySelector('[data-new-auth-box]');
  const form = document.querySelector('[data-new-review-form]');
  if (!authBox || !form) return;

  if (!state.user) {
    authBox.innerHTML = '<button type="button" class="review-auth-btn" data-new-login-google>Iniciar sesión con Google</button>';
    form.querySelector('button[type="submit"]').disabled = true;
    form.querySelector('textarea').disabled = true;

    authBox.querySelector('[data-new-login-google]')?.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error('Google login error:', error);
        setMessage('No se pudo iniciar sesión con Google.', 'is-error');
      }
    });

    return;
  }

  const userName = sanitize(state.user.displayName || 'Usuario');
  const userPhoto = sanitize(state.user.photoURL || '');
  authBox.innerHTML = `
    <div class="review-user-profile">
      ${userPhoto ? `<img src="${userPhoto}" alt="${userName}" referrerpolicy="no-referrer">` : ''}
      <span>${userName}</span>
    </div>
  `;

  form.querySelector('button[type="submit"]').disabled = false;
  form.querySelector('textarea').disabled = false;
}

function renderReviews(reviews) {
  const list = document.querySelector('[data-new-reviews-list]');
  const count = document.querySelector('[data-new-review-count]');
  const average = document.querySelector('[data-new-average-value]');
  const averageStars = document.querySelector('[data-new-average-stars]');

  if (!list || !count || !average || !averageStars) return;

  const total = reviews.length;
  const averageValue = total
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total
    : 0;

  count.textContent = `(${total} reseñas)`;
  average.textContent = `${averageValue.toFixed(1)} / 5`;
  averageStars.textContent = stars(Math.round(averageValue));

  if (!total) {
    list.innerHTML = '<p class="reviews-empty">Aún no hay opiniones para esta propiedad.</p>';
    return;
  }

  list.innerHTML = reviews.map((review) => {
    const userName = sanitize(review.userName || 'Usuario');
    const userPhoto = sanitize(review.userPhoto || '');
    const comment = sanitize(review.comment || '');

    return `
      <article class="review-card">
        <header>
          ${userPhoto ? `<img src="${userPhoto}" alt="${userName}" referrerpolicy="no-referrer">` : ''}
          <div>
            <strong>${userName}</strong>
            <p class="review-rating">${stars(review.rating || 0)}</p>
            <small>${formatDate(review.createdAt)}</small>
          </div>
        </header>
        <p>"${comment}"</p>
      </article>
    `;
  }).join('');
}

async function loadReviews() {
  const reviewQuery = query(
    collection(db, 'reviews'),
    where('propertyId', '==', state.propertyId)
  );

  const snapshot = await getDocs(reviewQuery);
  const reviews = snapshot.docs
    .map((reviewDoc) => ({ id: reviewDoc.id, ...reviewDoc.data() }))
    .sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

  renderReviews(reviews);
}

function bindReviewForm() {
  const form = document.querySelector('[data-new-review-form]');
  if (!form) return;

  form.querySelectorAll('[data-new-star]').forEach((starButton) => {
    starButton.addEventListener('click', () => {
      state.rating = Number(starButton.dataset.newStar || 0);
      refreshStarSelection();
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!state.user) {
      setMessage('Debes iniciar sesión con Google para enviar tu reseña.', 'is-error');
      return;
    }

    if (!state.rating || state.rating < 1 || state.rating > 5) {
      setMessage('Selecciona una calificación entre 1 y 5 estrellas.', 'is-error');
      return;
    }

    const commentField = form.querySelector('textarea[name="comment"]');
    const comment = String(commentField?.value || '').trim();

    if (!comment) {
      setMessage('Escribe un comentario para continuar.', 'is-error');
      return;
    }

    try {
      await addDoc(collection(db, 'reviews'), {
        propertyId: state.propertyId,
        userId: state.user.uid,
        userName: state.user.displayName || 'Usuario',
        userPhoto: state.user.photoURL || '',
        rating: state.rating,
        comment,
        createdAt: serverTimestamp()
      });

      form.reset();
      state.rating = 0;
      refreshStarSelection();
      setMessage('Reseña enviada correctamente.', 'is-success');
      await loadReviews();
    } catch (error) {
      console.error('Review save error:', error);
      setMessage('No se pudo guardar la reseña. Inténtalo de nuevo.', 'is-error');
    }
  });
}

async function initReviewSystem() {
  state.propertyId = getPropertyIdFromUrl();
  if (!state.propertyId) return;

  if (!renderShell()) return;

  bindReviewForm();
  refreshStarSelection();

  onAuthStateChanged(auth, (user) => {
    state.user = user;
    renderAuthBox();
  });

  await loadReviews();
}

window.addEventListener('propertyDetailReady', initReviewSystem);
window.addEventListener('DOMContentLoaded', initReviewSystem);
