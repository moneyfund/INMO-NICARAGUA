import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const REVIEWS_COLLECTION = 'reviews';
const PROPERTIES_COLLECTION = 'properties';

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

const state = {
  currentUser: null,
  selectedRating: 0,
  hoverRating: 0,
  initializedPropertyId: null,
  authUnsubscribe: null
};

function getPropertyIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const propertyId = params.get('id');
  console.log('Property ID:', propertyId);
  return propertyId;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getStars(rating = 0) {
  return Array.from({ length: 5 }, (_, index) => (index < rating ? '★' : '☆')).join(' ');
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value || Date.now());
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function renderNoPropertyMessage(section) {
  section.innerHTML = '<p class="reviews-firebase-status">No se encontró un identificador de propiedad válido.</p>';
}

function paintRatingStars(form, value) {
  const stars = form.querySelectorAll('[data-rating-star]');
  stars.forEach((star) => {
    const starValue = Number(star.dataset.ratingStar);
    star.classList.toggle('active', starValue <= value);
  });
}

function setStatus(section, message) {
  const status = section.querySelector('[data-firebase-status]');
  if (status) status.textContent = message;
}

function renderAuthControls(section) {
  const controls = section.querySelector('[data-auth-controls]');
  const requiredBox = section.querySelector('[data-review-auth-required]');
  const form = section.querySelector('[data-review-form]');

  if (!controls || !requiredBox || !form) return;

  if (!state.currentUser) {
    controls.innerHTML = '';
    requiredBox.classList.remove('hidden');
    form.classList.add('hidden');
    setStatus(section, 'Please sign in to leave a review');

    const loginBtn = requiredBox.querySelector('[data-login-google]');
    if (loginBtn) {
      loginBtn.onclick = async () => {
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (error) {
          console.error('No fue posible iniciar sesión con Google.', error);
        }
      };
    }

    return;
  }

  requiredBox.classList.add('hidden');
  form.classList.remove('hidden');
  setStatus(section, '');

  const name = escapeHtml(state.currentUser.displayName || 'Usuario');
  const photo = escapeHtml(state.currentUser.photoURL || 'assets/placeholder.svg');

  controls.innerHTML = `
    <div class="review-user-profile">
      <img src="${photo}" alt="${name}" referrerpolicy="no-referrer">
      <span>${name}</span>
      <button type="button" class="review-auth-btn review-auth-btn-outline" data-logout-google>Cerrar sesión</button>
    </div>
  `;

  const logoutBtn = controls.querySelector('[data-logout-google]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error('No fue posible cerrar sesión.', error);
      }
    });
  }
}

function updateSummary(section, reviews) {
  const averageStars = section.querySelector('[data-average-stars]');
  const averageValue = section.querySelector('[data-average-value]');
  const reviewCount = section.querySelector('[data-review-count]');

  const total = reviews.length;
  const average = total ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total : 0;

  averageStars.textContent = getStars(Math.round(average));
  averageValue.textContent = `${average.toFixed(1)} / 5`;
  reviewCount.textContent = `(${total} reseñas)`;
}

function renderReviewsList(section, reviews) {
  const list = section.querySelector('[data-reviews-list]');
  if (!list) return;

  if (!reviews.length) {
    list.innerHTML = '<p class="reviews-empty">Aún no hay opiniones para esta propiedad.</p>';
    return;
  }

  list.innerHTML = reviews.map((review) => {
    const userName = escapeHtml(review.userName || 'Usuario');
    const userPhoto = escapeHtml(review.userPhoto || 'assets/placeholder.svg');
    const comment = escapeHtml(review.comment || '');
    const rating = Number(review.rating || 0);

    return `
      <article class="review-card">
        <header>
          <img src="${userPhoto}" alt="${userName}" referrerpolicy="no-referrer">
          <div>
            <strong>${userName}</strong>
            <p class="review-rating">${getStars(rating)}</p>
          </div>
        </header>
        <p>${comment}</p>
        <small>${formatDate(review.createdAt)}</small>
      </article>
    `;
  }).join('');
}

async function loadReviews(section, propertyId) {
  try {
    const reviewsQuery = query(collection(db, REVIEWS_COLLECTION), where('propertyId', '==', propertyId));
    const snapshot = await getDocs(reviewsQuery);
    const reviews = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    updateSummary(section, reviews);
    renderReviewsList(section, reviews);
  } catch (error) {
    console.error('No se pudieron cargar las reseñas.', error);
    setStatus(section, 'No se pudieron cargar las reseñas.');
  }
}

function bindStars(form) {
  const stars = form.querySelectorAll('[data-rating-star]');
  const ratingInput = form.querySelector('[name="rating"]');

  stars.forEach((star) => {
    const starValue = Number(star.dataset.ratingStar);

    star.addEventListener('mouseenter', () => {
      state.hoverRating = starValue;
      paintRatingStars(form, state.hoverRating);
    });

    star.addEventListener('click', () => {
      state.selectedRating = starValue;
      ratingInput.value = String(starValue);
      paintRatingStars(form, state.selectedRating);
    });
  });

  form.querySelector('.review-form-stars')?.addEventListener('mouseleave', () => {
    state.hoverRating = 0;
    paintRatingStars(form, state.selectedRating);
  });
}

function setFormMessage(form, message) {
  const messageElement = form.querySelector('[data-review-form-message]');
  if (messageElement) messageElement.textContent = message;
}

async function submitReview(event, propertyId, section) {
  event.preventDefault();

  const form = event.currentTarget;
  const commentText = form.querySelector('[name="comment"]').value.trim();
  const rawRating = Number(form.querySelector('[name="rating"]').value || 0);
  const ratingValue = Math.min(5, Math.max(1, rawRating));
  const user = state.currentUser;

  console.log('User:', user);
  console.log('Property ID:', propertyId);

  if (!user) {
    setFormMessage(form, 'Please sign in to leave a review');
    return;
  }

  if (!propertyId) {
    setFormMessage(form, 'Property not found');
    return;
  }

  if (!rawRating || rawRating < 1 || rawRating > 5) {
    setFormMessage(form, 'Selecciona una calificación de estrellas.');
    return;
  }

  if (!commentText) {
    setFormMessage(form, 'Escribe un comentario para continuar.');
    return;
  }

  try {
    const propertyRef = doc(db, PROPERTIES_COLLECTION, propertyId);
    const propertySnap = await getDoc(propertyRef);

    if (!propertySnap.exists()) {
      setFormMessage(form, 'Property not found');
      return;
    }

    console.log('Submitting review');
    await addDoc(collection(db, REVIEWS_COLLECTION), {
      propertyId: propertyId,
      rating: ratingValue,
      comment: commentText,
      userName: user.displayName || 'Usuario',
      userEmail: user.email || '',
      userPhoto: user.photoURL || '',
      createdAt: serverTimestamp()
    });

    form.reset();
    state.selectedRating = 0;
    paintRatingStars(form, 0);
    setFormMessage(form, 'Reseña enviada correctamente.');
    await loadReviews(section, propertyId);
  } catch (error) {
    console.error('No se pudo guardar la reseña.', error);
    setFormMessage(form, 'No se pudo guardar la reseña.');
  }
}

async function initReviews(forcedPropertyId = null) {
  const section = document.getElementById('propertyReviews');
  if (!section) return;

  const propertyId = forcedPropertyId || getPropertyIdFromUrl();
  if (!propertyId) {
    renderNoPropertyMessage(section);
    return;
  }

  if (state.initializedPropertyId === propertyId) {
    return;
  }

  state.initializedPropertyId = propertyId;
  const propertyRef = doc(db, PROPERTIES_COLLECTION, propertyId);
  const propertySnap = await getDoc(propertyRef);

  if (!propertySnap.exists()) {
    setStatus(section, 'Property not found');
    return;
  }

  const form = section.querySelector('[data-review-form]');
  if (!form) return;

  bindStars(form);
  form.addEventListener('submit', (event) => submitReview(event, propertyId, section));

  if (!state.authUnsubscribe) {
    state.authUnsubscribe = onAuthStateChanged(auth, (user) => {
      state.currentUser = user;
      console.log('User:', user);
      renderAuthControls(section);
    });
  } else {
    renderAuthControls(section);
  }

  await loadReviews(section, propertyId);
}

function init() {
  window.addEventListener('propertyDetailReady', (event) => {
    const propertyId = event?.detail?.propertyId || getPropertyIdFromUrl();
    initReviews(propertyId);
  });

  if (document.getElementById('propertyReviews')) {
    initReviews();
  }
}

window.addEventListener('DOMContentLoaded', init);
