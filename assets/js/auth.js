import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

import { auth, googleProvider, firebaseError } from './firebase-config.js';

const authState = {
  currentUser: null,
  listeners: []
};

function notifyAuthListeners() {
  authState.listeners.forEach((listener) => listener(authState.currentUser));
}

function createUserMarkup(user) {
  const photo = user.photoURL || 'assets/placeholder.svg';
  const name = user.displayName || 'Usuario';

  return `
    <div class="review-user-profile">
      <img src="${photo}" alt="${name}" referrerpolicy="no-referrer">
      <span>${name}</span>
      <button type="button" class="review-auth-btn review-auth-btn-outline" data-logout-google>Cerrar sesión</button>
    </div>
  `;
}

function createLoggedOutMarkup() {
  return '<button type="button" class="review-auth-btn" data-login-google>Login with Google</button>';
}


async function signInWithGoogle() {
  if (firebaseError || !auth) return;

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error('No fue posible iniciar sesión con Google.', error);
  }
}

export function renderAuthControls(container) {
  if (!container) return;

  if (firebaseError || !auth) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = authState.currentUser
    ? createUserMarkup(authState.currentUser)
    : createLoggedOutMarkup();

  const loginButton = container.querySelector('[data-login-google]');
  if (loginButton) {
    loginButton.addEventListener('click', async () => {
      await signInWithGoogle();
    });
  }

  const logoutButton = container.querySelector('[data-logout-google]');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error('No fue posible cerrar sesión.', error);
      }
    });
  }
}

export function subscribeToAuth(callback) {
  authState.listeners.push(callback);
  callback(authState.currentUser);

  return () => {
    authState.listeners = authState.listeners.filter((listener) => listener !== callback);
  };
}

export function initAuth() {
  if (firebaseError || !auth) {
    notifyAuthListeners();
    return;
  }

  onAuthStateChanged(auth, (user) => {
    authState.currentUser = user;
    notifyAuthListeners();
  });
}

export function getCurrentUser() {
  return authState.currentUser;
}

export async function loginWithGoogle() {
  await signInWithGoogle();
}
