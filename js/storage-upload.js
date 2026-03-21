import {
  auth,
  storage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from './firebase-services.js';

const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024;
const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const UPLOAD_TIMEOUT_MS = 90_000;

function createStoragePath(userId, fileName) {
  const safeName = String(fileName || 'imagen')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase();

  return `propiedades/${userId}/${Date.now()}-${safeName}`;
}

function validateImageFile(file, options = {}) {
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const allowedTypes = options.allowedTypes ?? DEFAULT_ALLOWED_TYPES;

  if (!(file instanceof File)) {
    throw new Error('El archivo recibido no es válido.');
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Tipo de archivo no permitido: ${file.type || 'desconocido'}.`);
  }

  if (file.size <= 0) {
    throw new Error(`El archivo ${file.name} está vacío.`);
  }

  if (file.size > maxFileSize) {
    throw new Error(`El archivo ${file.name} supera el máximo permitido de ${Math.round(maxFileSize / (1024 * 1024))}MB.`);
  }
}

function mapStorageError(error) {
  const code = error?.code || 'storage/unknown';

  switch (code) {
    case 'storage/unauthorized':
      return 'Firebase Storage rechazó la subida por permisos insuficientes (storage/unauthorized).';
    case 'storage/unauthenticated':
      return 'Debes iniciar sesión antes de subir imágenes (storage/unauthenticated).';
    case 'storage/bucket-not-found':
      return 'No se encontró el bucket configurado en Firebase Storage (storage/bucket-not-found). Revisa storageBucket.';
    case 'storage/canceled':
      return 'La subida fue cancelada manualmente.';
    case 'storage/retry-limit-exceeded':
      return 'Firebase agotó los reintentos de subida. Verifica tu conexión e intenta nuevamente.';
    default:
      return error?.message || 'Ocurrió un error inesperado al subir la imagen.';
  }
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

async function ensureAuthenticatedUser() {
  if (auth.currentUser) return auth.currentUser;

  console.warn('[StorageUpload] request.auth == null. No hay usuario autenticado al intentar subir.');
  throw new Error('Debes iniciar sesión antes de subir imágenes.');
}

export async function subirImagen(file, options = {}) {
  console.log('[StorageUpload] Iniciando subirImagen...');
  const user = await ensureAuthenticatedUser();
  validateImageFile(file, options);

  const path = createStoragePath(user.uid, file.name);
  const storageRef = ref(storage, path);

  console.log('[StorageUpload] Subiendo imagen...', {
    name: file.name,
    size: file.size,
    type: file.type,
    path,
    bucket: storage?.app?.options?.storageBucket || 'sin-configurar'
  });

  try {
    const snapshot = await withTimeout(new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
        cacheControl: 'public,max-age=3600'
      });

      task.on(
        'state_changed',
        (current) => {
          const progress = current.totalBytes
            ? Math.round((current.bytesTransferred / current.totalBytes) * 100)
            : 0;

          console.log('[StorageUpload] Progreso de subida:', {
            file: file.name,
            progress,
            bytesTransferred: current.bytesTransferred,
            totalBytes: current.totalBytes,
            state: current.state
          });

          if (typeof options.onProgress === 'function') {
            options.onProgress(progress, current);
          }
        },
        (error) => {
          console.error('[StorageUpload] Error durante uploadBytesResumable:', error);
          reject(new Error(mapStorageError(error)));
        },
        () => resolve(task.snapshot)
      );
    }), options.timeoutMs ?? UPLOAD_TIMEOUT_MS, `La subida de ${file.name} excedió el tiempo de espera y quedó colgada.`);

    console.log('[StorageUpload] Imagen subida.', {
      file: file.name,
      fullPath: snapshot.ref.fullPath
    });

    const url = await getDownloadURL(snapshot.ref);
    console.log('[StorageUpload] URL obtenida.', { file: file.name, url });

    return {
      url,
      path: snapshot.ref.fullPath,
      name: file.name,
      contentType: file.type,
      size: file.size
    };
  } catch (error) {
    console.error('[StorageUpload] Falló subirImagen.', error);
    throw error;
  }
}

export async function subirMultiplesImagenes(files, options = {}) {
  console.log('[StorageUpload] Iniciando subirMultiplesImagenes...');
  if (!Array.isArray(files)) {
    throw new Error('La lista de imágenes no es válida.');
  }

  const uploads = [];

  for (const image of files) {
    const file = image?.file ?? image;
    console.log('[StorageUpload] Procesando archivo en lote...', file?.name || 'sin-nombre');

    const uploaded = await subirImagen(file, {
      ...options,
      onProgress: (progress, snapshot) => {
        if (image && typeof image === 'object') {
          image.progress = progress;
          image.error = '';
        }

        if (typeof options.onItemProgress === 'function') {
          options.onItemProgress(image, progress, snapshot);
        }
      }
    });

    uploads.push(uploaded);
  }

  console.log('[StorageUpload] Lote completado.', { total: uploads.length });
  return uploads;
}

export { validateImageFile };
