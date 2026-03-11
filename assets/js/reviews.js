import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

import { db, firebaseError } from './firebase-config.js';
import { getCurrentUser, initAuth, renderAuthControls, subscribeToAuth } from './auth.js';

const REVIEWS_COLLECTION = 'property_reviews';
let reviewsUnsubscribe = null;
let lazyStarted = false;

function formatDate(timestamp) {
  const dateValue = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp || Date.now());
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(dateValue);
}

function starsMarkup(rating = 0) {
  return Array.from({ length: 5 }, (_, index) => (index < rating ? '★' : '☆')).join(' ');
}

function renderList(listElement, reviews) {
  if (!listElement) return;

  if (!reviews.length) {
    listElement.innerHTML = '<p class="reviews-empty">Aún no hay opiniones para esta propiedad.</p>';
    return;
  }

  listElement.innerHTML = reviews.map((review) => `
    <article class="review-card">
      <header>
        <img src="${review.userPhoto || 'assets/placeholder.svg'}" alt="${review.userName}" referrerpolicy="no-referrer">
        <div>
          <strong>${review.userName || 'Usuario'}</strong>
          <p class="review-rating">${starsMarkup(review.rating)} <span>${Number(review.rating || 0).toFixed(1)}</span></p>
        </div>
      </header>
      <p>${review.comment || ''}</p>
      <small>${formatDate(review.date)}</small>
    </article>
  `).join('');
}

function updateSummary(summaryElement, reviews) {
  if (!summaryElement) return;

  const total = reviews.length;
  const average = total
    ? reviews.reduce((acc, review) => acc + Number(review.rating || 0), 0) / total
    : 0;

  summaryElement.querySelector('[data-average-stars]').textContent = starsMarkup(Math.round(average));
  summaryElement.querySelector('[data-average-value]').textContent = `${average.toFixed(1)} / 5`;
  summaryElement.querySelector('[data-review-count]').textContent = `(${total} reseñas)`;
}

function setupInteractiveStars(form) {
  const stars = Array.from(form.querySelectorAll('[data-rating-star]'));
  const ratingInput = form.querySelector('[name="rating"]');

  function paintStars(value) {
    stars.forEach((star) => {
      const starValue = Number(star.dataset.ratingStar);
      star.classList.toggle('is-active', starValue <= value);
    });
  }

  stars.forEach((star) => {
    star.addEventListener('click', () => {
      const value = Number(star.dataset.ratingStar);
      ratingInput.value = String(value);
      paintStars(value);
    });
  });

  paintStars(Number(ratingInput.value || 0));
}

function setFormState(form, canComment, message) {
  const controls = form.querySelectorAll('textarea, button[data-rating-star], button[type="submit"]');
  controls.forEach((control) => {
    control.disabled = !canComment;
  });

  const messageElement = form.querySelector('[data-review-form-message]');
  messageElement.textContent = message || '';
}

async function saveReview(propertyId, form) {
  const user = getCurrentUser();
  if (!user || !db) return;

  const rating = Number(form.querySelector('[name="rating"]').value || 0);
  const comment = form.querySelector('[name="comment"]').value.trim();

  if (!rating || !comment) {
    setFormState(form, true, 'Selecciona estrellas y escribe un comentario antes de enviar.');
    return;
  }

  const reviewDocId = `${propertyId}_${user.uid}`;

  await setDoc(doc(db, REVIEWS_COLLECTION, reviewDocId), {
    propertyId,
    userName: user.displayName || 'Usuario',
    userPhoto: user.photoURL || '',
    userId: user.uid,
    rating,
    comment,
    date: serverTimestamp()
  }, { merge: true });

  setFormState(form, true, 'Tu reseña fue guardada correctamente.');
}

function initReviewsForProperty(propertyId) {
  const section = document.getElementById('propertyReviews');
  if (!section || lazyStarted) return;
  lazyStarted = true;

  const authContainer = section.querySelector('[data-auth-controls]');
  const summary = section.querySelector('[data-reviews-summary]');
  const reviewsList = section.querySelector('[data-reviews-list]');
  const form = section.querySelector('[data-review-form]');

  if (firebaseError || !db) {
    section.querySelector('[data-firebase-status]').textContent = 'Las reseñas no están disponibles temporalmente.';
    form.classList.add('hidden');
    return;
  }

  renderAuthControls(authContainer);
  subscribeToAuth((user) => {
    renderAuthControls(authContainer);
    const blockedMessage = 'Debes iniciar sesión con Google para comentar.';
    setFormState(form, Boolean(user), user ? '' : blockedMessage);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await saveReview(propertyId, form);
    } catch (error) {
      console.error('No se pudo guardar la reseña.', error);
      setFormState(form, true, 'No se pudo guardar tu reseña. Intenta nuevamente.');
    }
  });

  setupInteractiveStars(form);

  if (reviewsUnsubscribe) reviewsUnsubscribe();
  const reviewsQuery = query(collection(db, REVIEWS_COLLECTION), where('propertyId', '==', propertyId));

  reviewsUnsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
    const reviews = snapshot.docs
      .map((reviewDoc) => ({ id: reviewDoc.id, ...reviewDoc.data() }))
      .sort((a, b) => {
        const aDate = a.date?.seconds || 0;
        const bDate = b.date?.seconds || 0;
        return bDate - aDate;
      });

    updateSummary(summary, reviews);
    renderList(reviewsList, reviews);
  }, (error) => {
    console.error('No fue posible escuchar reseñas.', error);
    section.querySelector('[data-firebase-status]').textContent = 'Las reseñas no están disponibles temporalmente.';
  });
}

function setupLazyLoad(propertyId) {
  const section = document.getElementById('propertyReviews');
  if (!section) return;

  const observer = new IntersectionObserver((entries, ref) => {
    const isVisible = entries.some((entry) => entry.isIntersecting);
    if (!isVisible) return;

    initReviewsForProperty(propertyId);
    ref.disconnect();
  }, { threshold: 0.15 });

  observer.observe(section);
}

window.addEventListener('propertyDetailReady', (event) => {
  const propertyId = String(event.detail?.propertyId || event.detail?.property?.id || '');
  if (!propertyId) return;

  initAuth();
  setupLazyLoad(propertyId);
});
