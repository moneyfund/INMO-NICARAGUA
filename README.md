# INMO NICARAGUA

Sitio web inmobiliario profesional desarrollado con HTML, CSS y JavaScript vanilla.

## Estructura

- `index.html`
- `propiedades.html`
- `propiedad.html`
- `agentes.html`
- `agent.html`
- `agent-dashboard.html`
- `css/styles.css`
- `js/main.js`
- `js/properties.js`
- `js/agentes.js`
- `js/agent-public.js`
- `js/agent-dashboard.js`
- `js/firebase-client.js`
- `firestore.rules`

## Uso local

Abre `index.html` con un servidor estático para que la carga de Firebase funcione correctamente.

Ejemplo:

```bash
python3 -m http.server 8000
```

Luego visita `http://localhost:8000`.

## Multi-agente con Firebase

Se implementó un sistema multi-agente con Firestore:

- Colección `agents` (1 documento por agente con id = `uid`).
- Colección `properties` (cada propiedad incluye `agentId`, `agentName`, `status`, `images`, `video`, etc.).
- Dashboard de agente en `agent-dashboard.html` para:
  - editar su perfil,
  - agregar propiedades,
  - editar propiedades propias,
  - marcar propiedades como vendidas.
- Perfil público del agente en `agent.html?id=AGENT_UID`.
- Sitio público (`index.html`, `propiedades.html`, `propiedad.html`, `mapa.html`, `agentes.html`) leyendo datos desde Firestore.

## Reglas recomendadas de Firestore

Usa el archivo `firestore.rules` para asegurar que cada agente solo pueda escribir su perfil y sus propiedades.

Publicación sugerida:

```bash
firebase deploy --only firestore:rules
```

## Formato recomendado para imágenes

- Usa enlaces directos que terminen en `.jpg`, `.jpeg`, `.png` o `.webp`.
- Evita URLs de Facebook (`facebook.com`, `fbcdn.net`), porque suelen bloquear la carga directa de imágenes.
- El frontend mantiene fallback automático para imágenes inválidas usando `assets/placeholder.svg`.


## Subida de imágenes con Firebase Storage

El panel `agent-dashboard.html` ahora permite:

- seleccionar múltiples imágenes desde el equipo,
- arrastrar y soltar,
- previsualizar antes de guardar,
- comprimir imágenes grandes antes de subir,
- subir archivos a `propiedades/{userId}/{timestamp}-{filename}` en Firebase Storage,
- guardar automáticamente las URLs resultantes en Firestore dentro de `images` e `imagenes`.

### Reglas recomendadas de Storage

Para pruebas rápidas, usa temporalmente estas reglas:

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Si con estas reglas funciona, el problema estaba en permisos/ruta del bucket y luego puedes endurecerlas.

Publica también `storage.rules`:

```bash
firebase deploy --only storage
```
