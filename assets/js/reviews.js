import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import { auth, provider, db } from './firebase-config.js';

const REVIEWS_COLLECTION = 'property_reviews';

const state = {
  currentUser: null,
  selectedRating: 0,
  hoverRating: 0,
  unsubscribeReviews: null
};

function getPropertyIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
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
  section.innerHTML = '<p class="reviews-firebase-status">Propiedad no encontrada</p>';
}

function paintRatingStars(form, value) {
  const stars = form.querySelectorAll('[data-rating-star]');
  stars.forEach((star) => {
    const starValue = Number(star.dataset.ratingStar);
    star.classList.toggle('active', starValue <= value);
  });
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

    const loginBtn = requiredBox.querySelector('[data-login-google]');
    if (loginBtn) {
      loginBtn.onclick = async () => {
        try {
          await signInWithPopup(auth, provider);
        } catch (error) {
          console.error('No fue posible iniciar sesión con Google.', error);
        }
      };
    }

    return;
  }

  requiredBox.classList.add('hidden');
  form.classList.remove('hidden');

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

async function submitReview(event, propertyId) {
  event.preventDefault();

  const form = event.currentTarget;
  const comment = form.querySelector('[name="comment"]').value.trim();
  const rating = Number(form.querySelector('[name="rating"]').value || 0);

  if (!state.currentUser) {
    setFormMessage(form, 'Debes iniciar sesión con Google para dejar una reseña.');
    return;
  }

  if (!rating) {
    setFormMessage(form, 'Selecciona una calificación de estrellas.');
    return;
  }

  if (!comment) {
    setFormMessage(form, 'Escribe un comentario para continuar.');
    return;
  }

  try {
    await addDoc(collection(db, REVIEWS_COLLECTION), {
      propertyId,
      userId: state.currentUser.uid,
      userName: state.currentUser.displayName || 'Usuario',
      userPhoto: state.currentUser.photoURL || '',
      rating,
      comment,
      createdAt: serverTimestamp()
    });

    form.reset();
    state.selectedRating = 0;
    paintRatingStars(form, 0);
    setFormMessage(form, 'Reseña enviada correctamente.');
  } catch (error) {
    console.error('No se pudo guardar la reseña.', error);
    setFormMessage(form, 'No se pudo guardar la reseña.');
  }
}

function listenReviews(section, propertyId) {
  if (state.unsubscribeReviews) state.unsubscribeReviews();

  const reviewsQuery = query(collection(db, REVIEWS_COLLECTION), where('propertyId', '==', propertyId));

  state.unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
    const reviews = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    updateSummary(section, reviews);
    renderReviewsList(section, reviews);
  }, (error) => {
    console.error('No se pudieron cargar las reseñas.', error);
    const status = section.querySelector('[data-firebase-status]');
    if (status) status.textContent = 'No se pudieron cargar las reseñas.';
  });
}

function init() {
  const section = document.getElementById('propertyReviews');
  if (!section) return;

  const propertyId = getPropertyIdFromUrl();
  if (!propertyId) {
    renderNoPropertyMessage(section);
    return;
  }

  if (!auth || !provider || !db) {
    const status = section.querySelector('[data-firebase-status]');
    if (status) status.textContent = 'No se pudieron cargar las reseñas.';
    return;
  }

  const form = section.querySelector('[data-review-form]');
  bindStars(form);

  form.addEventListener('submit', (event) => submitReview(event, propertyId));

  onAuthStateChanged(auth, (user) => {
    state.currentUser = user;
    renderAuthControls(section);
  });

  listenReviews(section, propertyId);
}

window.addEventListener('DOMContentLoaded', init);
