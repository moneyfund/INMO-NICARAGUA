const REVIEWS_COLLECTION = 'reviews';

const state = {
  currentUser: null,
  selectedRating: 0,
  hoverRating: 0,
  unsubscribeReviews: null,
  initializedPropertyId: null,
  authUnsubscribe: null
};

function getFirebaseClient() {
  return window.inmoFirebase?.enabled ? window.inmoFirebase : null;
}

function getPropertyIdFromUrl() {
  const propertyId = new URLSearchParams(window.location.search).get('id');
  console.log("PropertyId:", propertyId);
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

function getActiveUser() {
  const client = getFirebaseClient();
  return state.currentUser || client?.currentUser || client?.auth?.currentUser || null;
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
        const client = getFirebaseClient();
        if (!client?.auth || !client?.provider) return;
        try {
          await client.auth.signInWithPopup(client.provider);
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
      const client = getFirebaseClient();
      if (!client?.auth) return;
      try {
        await client.auth.signOut();
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
  const rawRating = Number(form.querySelector('[name="rating"]').value || 0);
  const rating = Math.min(5, Math.max(1, rawRating));
  const client = getFirebaseClient();
  const user = getActiveUser();

  console.log("User:", user);
  console.log("PropertyId:", propertyId);

  if (!user) {
    setFormMessage(form, 'Please sign in to leave a review');
    return;
  }

  if (!client?.db) {
    console.warn('[Reviews] Submit bloqueado: usuario no autenticado o Firestore no disponible.', {
      hasUser: Boolean(user),
      hasDb: Boolean(client?.db)
    });
    setFormMessage(form, 'No se pudo conectar con Firestore.');
    return;
  }

  if (!propertyId) {
    setFormMessage(form, 'No se encontró la propiedad para registrar la reseña.');
    return;
  }

  if (!rawRating || rawRating < 1 || rawRating > 5) {
    setFormMessage(form, 'Selecciona una calificación de estrellas.');
    return;
  }

  if (!comment) {
    setFormMessage(form, 'Escribe un comentario para continuar.');
    return;
  }

  const reviewPayload = {
    propertyId,
    rating,
    comment,
    userName: user.displayName || 'Usuario',
    userEmail: user.email || '',
    userPhoto: user.photoURL || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    console.log("Submitting review...");
    console.log('[Reviews] Guardando reseña en Firestore...', reviewPayload);
    await client.db.collection(REVIEWS_COLLECTION).add(reviewPayload);
    console.log('[Reviews] review submission result: success');

    form.reset();
    state.selectedRating = 0;
    paintRatingStars(form, 0);
    setFormMessage(form, 'Reseña enviada correctamente.');
  } catch (error) {
    console.error('No se pudo guardar la reseña.', error);
    console.log('[Reviews] review submission result: error');
    setFormMessage(form, 'No se pudo guardar la reseña.');
  }
}

function listenReviews(section, propertyId) {
  const client = getFirebaseClient();
  if (!client?.db) return;

  if (state.unsubscribeReviews) state.unsubscribeReviews();

  const reviewsQuery = client.db.collection(REVIEWS_COLLECTION)
    .where('propertyId', '==', propertyId);

  state.unsubscribeReviews = reviewsQuery
    .onSnapshot((snapshot) => {
      console.log('[Reviews] Snapshot recibido para propiedad:', propertyId, 'cantidad:', snapshot.size);
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

async function initReviews(forcedPropertyId = null) {
  const section = document.getElementById('propertyReviews');
  if (!section) return;

  const propertyId = forcedPropertyId || getPropertyIdFromUrl();
  if (!propertyId) {
    renderNoPropertyMessage(section);
    return;
  }

  if (state.initializedPropertyId === propertyId) {
    console.log('[Reviews] Ya inicializado para esta propiedad.');
    return;
  }

  state.initializedPropertyId = propertyId;
  console.log('[Reviews] Inicializando módulo para propiedad:', propertyId);

  const client = getFirebaseClient();
  if (!client?.auth || !client?.db) {
    const status = section.querySelector('[data-firebase-status]');
    if (status) status.textContent = 'No se pudieron cargar las reseñas.';
    return;
  }

  const form = section.querySelector('[data-review-form]');
  if (!form) return;

  bindStars(form);
  form.addEventListener('submit', (event) => submitReview(event, propertyId));

  if (!state.authUnsubscribe) {
    state.authUnsubscribe = client.auth.onAuthStateChanged((user) => {
      state.currentUser = user;
      if (client) client.currentUser = user;
      console.log("User:", user);
      console.log('[Reviews] user login state:', user ? { uid: user.uid, email: user.email } : null);
      renderAuthControls(section);
    });
  } else {
    renderAuthControls(section);
  }

  listenReviews(section, propertyId);
}

function init() {
  window.addEventListener('propertyDetailReady', (event) => {
    const propertyId = event?.detail?.propertyId || getPropertyIdFromUrl();
    initReviews(propertyId);
  });

  if (document.getElementById('propertyReviews')) {
    initReviews();
  }

  document.addEventListener('inmo:firebase-ready', () => {
    if (document.getElementById('propertyReviews')) initReviews();
  });
}

window.addEventListener('DOMContentLoaded', init);
