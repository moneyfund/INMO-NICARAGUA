import { storage } from './firebase-services.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

export async function uploadImage(file, agentId, propertyId) {
  if (!file) throw new Error('Archivo de imagen no válido.');
  if (!agentId) throw new Error('No se pudo determinar el agente de la propiedad.');
  if (!propertyId) throw new Error('No se pudo determinar la propiedad para la subida de imágenes.');

  const safeName = String(file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${Date.now()}-${safeName}`;
  const path = `properties/${agentId}/${propertyId}/${fileName}`;

  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type || 'image/jpeg'
  });

  const url = await getDownloadURL(snapshot.ref);
  return url;
}
