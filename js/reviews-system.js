import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
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
  rating: 0,
  isInitialized: false,
  activeReviewUnsubscribes: []
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

function renderStarIcons(rating = 0, className = 'rating-stars') {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return `
    <span class="${className}" aria-label="${safeRating} de 5 estrellas">
      ${Array.from({ length: 5 }, (_, index) => `
        <svg class="rating-star-icon ${index < safeRating ? 'is-filled' : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3.6l2.63 5.32 5.87.85-4.25 4.14 1 5.84L12 17.03l-5.25 2.72 1-5.84L3.5 9.77l5.87-.85L12 3.6z"></path>
        </svg>
      `).join('')}
    </span>
  `;
}

function formatDate(createdAt) {
  if (createdAt?.toDate) {
    return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(createdAt.toDate());
  }

  if (createdAt instanceof Date) {
    return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(createdAt);
  }

  if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
    }
  }

  return 'Fecha pendiente';
}

function normalizeReview(docData = {}, id = '', source = '') {
  const rating = Math.max(0, Math.min(5, Number(docData.rating || 0)));
  return {
    id,
    source,
    propertyId: String(docData.propertyId || docData.propertyID || '').trim(),
    userName: docData.userName || docData.authorName || docData.name || 'Usuario',
    userPhoto: docData.userPhoto || docData.photoURL || docData.avatar || '',
    comment: docData.comment || docData.content || docData.review || '',
    rating,
    createdAt: docData.createdAt || docData.date || null
  };
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
      <p class="reviews-stars" data-new-average-stars>${renderStarIcons(0, 'rating-stars rating-stars-summary')}</p>
      <p class="reviews-average" data-new-average-value>0.0 / 5</p>
      <p class="reviews-count" data-new-review-count>(0 reseñas)</p>
    </div>
    <form class="review-form" data-new-review-form>
      <div class="review-form-stars" aria-label="Calificación de estrellas">
        <button type="button" data-new-star="1" aria-label="1 estrella">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.6l2.63 5.32 5.87.85-4.25 4.14 1 5.84L12 17.03l-5.25 2.72 1-5.84L3.5 9.77l5.87-.85L12 3.6z"></path></svg>
        </button>
        <button type="button" data-new-star="2" aria-label="2 estrellas">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.6l2.63 5.32 5.87.85-4.25 4.14 1 5.84L12 17.03l-5.25 2.72 1-5.84L3.5 9.77l5.87-.85L12 3.6z"></path></svg>
        </button>
        <button type="button" data-new-star="3" aria-label="3 estrellas">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.6l2.63 5.32 5.87.85-4.25 4.14 1 5.84L12 17.03l-5.25 2.72 1-5.84L3.5 9.77l5.87-.85L12 3.6z"></path></svg>
        </button>
        <button type="button" data-new-star="4" aria-label="4 estrellas">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.6l2.63 5.32 5.87.85-4.25 4.14 1 5.84L12 17.03l-5.25 2.72 1-5.84L3.5 9.77l5.87-.85L12 3.6z"></path></svg>
        </button>
        <button type="button" data-new-star="5" aria-label="5 estrellas">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.6l2.63 5.32 5.87.85-4.25 4.14 1 5.84L12 17.03l-5.25 2.72 1-5.84L3.5 9.77l5.87-.85L12 3.6z"></path></svg>
        </button>
      </div>
      <textarea name="comment" rows="4" maxlength="600" placeholder="Comparte tu opinión sobre esta propiedad..."></textarea>
      <button type="submit">Enviar reseña</button>
      <p class="review-form-message" data-new-review-message></p>
    </form>
    <div class="reviews-list" data-new-reviews-list>
      <p class="reviews-empty">Aún no hay reseñas para esta propiedad</p>
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
  averageStars.innerHTML = renderStarIcons(Math.round(averageValue), 'rating-stars rating-stars-summary');

  if (!total) {
    list.innerHTML = '<p class="reviews-empty">Aún no hay reseñas para esta propiedad</p>';
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
            <p class="review-rating">${renderStarIcons(review.rating || 0)}</p>
            <small>${formatDate(review.createdAt)}</small>
          </div>
        </header>
        <p>${comment}</p>
      </article>
    `;
  }).join('');
}

function sortReviews(items = []) {
  return [...items].sort((a, b) => {
    const timeA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
    const timeB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
    return timeB - timeA;
  });
}

function clearReviewSubscriptions() {
  state.activeReviewUnsubscribes.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn('No se pudo cerrar suscripción de reseñas:', error);
    }
  });
  state.activeReviewUnsubscribes = [];
}

function subscribeToReviews() {
  const reviewBuckets = {
    topLevel: [],
    topLevelAlt: [],
    nested: []
  };

  const updateView = () => {
    const merged = [...reviewBuckets.topLevel, ...reviewBuckets.topLevelAlt, ...reviewBuckets.nested];
    const uniqueByKey = new Map();

    merged.forEach((item) => {
      const key = `${item.userName}-${item.comment}-${item.rating}-${item.createdAt?.seconds || item.createdAt || ''}`;
      uniqueByKey.set(key, item);
    });

    renderReviews(sortReviews(Array.from(uniqueByKey.values())));
  };

  const topLevelQuery = query(collection(db, 'reviews'), where('propertyId', '==', state.propertyId));
  const topLevelAltQuery = query(collection(db, 'reviews'), where('propertyID', '==', state.propertyId));
  const nestedCollectionRef = collection(db, 'properties', state.propertyId, 'reviews');

  const unsubTop = onSnapshot(topLevelQuery, (snapshot) => {
    reviewBuckets.topLevel = snapshot.docs.map((docSnap) => normalizeReview(docSnap.data(), docSnap.id, 'reviews'));
    updateView();
  }, (error) => {
    console.error('Error leyendo reseñas en /reviews (propertyId):', error);
  });

  const unsubTopAlt = onSnapshot(topLevelAltQuery, (snapshot) => {
    reviewBuckets.topLevelAlt = snapshot.docs.map((docSnap) => normalizeReview(docSnap.data(), docSnap.id, 'reviews'));
    updateView();
  }, () => {
    reviewBuckets.topLevelAlt = [];
    updateView();
  });

  const unsubNested = onSnapshot(nestedCollectionRef, (snapshot) => {
    reviewBuckets.nested = snapshot.docs
      .map((docSnap) => normalizeReview({ propertyId: state.propertyId, ...docSnap.data() }, docSnap.id, 'properties/reviews'));
    updateView();
  }, () => {
    reviewBuckets.nested = [];
    updateView();
  });

  state.activeReviewUnsubscribes = [unsubTop, unsubTopAlt, unsubNested];
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

    const payload = {
      propertyId: state.propertyId,
      userId: state.user.uid,
      userName: state.user.displayName || 'Usuario',
      userPhoto: state.user.photoURL || '',
      rating: state.rating,
      comment,
      content: comment,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'reviews'), payload);
      form.reset();
      state.rating = 0;
      refreshStarSelection();
      setMessage('Reseña enviada correctamente.', 'is-success');
    } catch (error) {
      console.warn('No se pudo guardar en /reviews, intentando subcolección.', error);
      try {
        await addDoc(collection(db, 'properties', state.propertyId, 'reviews'), {
          ...payload,
          propertyId: state.propertyId
        });
        form.reset();
        state.rating = 0;
        refreshStarSelection();
        setMessage('Reseña enviada correctamente.', 'is-success');
      } catch (nestedError) {
        console.error('Review save error:', nestedError);
        setMessage('No se pudo guardar la reseña. Inténtalo de nuevo.', 'is-error');
      }
    }
  });
}

async function initReviewSystem() {
  const nextPropertyId = getPropertyIdFromUrl();
  if (!nextPropertyId) return;

  state.propertyId = nextPropertyId;

  if (!renderShell()) return;

  clearReviewSubscriptions();
  bindReviewForm();
  refreshStarSelection();
  subscribeToReviews();

  if (!state.isInitialized) {
    onAuthStateChanged(auth, (user) => {
      state.user = user;
      renderAuthBox();
    });
    state.isInitialized = true;
  } else {
    renderAuthBox();
  }
}


function queueReviewSystemInit() {
  window.requestAnimationFrame(() => {
    initReviewSystem().catch((error) => {
      console.error('No se pudo inicializar el sistema de reseñas:', error);
    });
  });
}

window.addEventListener('propertyDetailReady', queueReviewSystemInit);
window.addEventListener('DOMContentLoaded', queueReviewSystemInit);
window.addEventListener('load', queueReviewSystemInit);
window.addEventListener('beforeunload', clearReviewSubscriptions);

const reviewSectionObserver = new MutationObserver(() => {
  if (!document.getElementById('propertyReviews')) return;
  queueReviewSystemInit();
});

if (document.body) {
  reviewSectionObserver.observe(document.body, { childList: true, subtree: true });
}
