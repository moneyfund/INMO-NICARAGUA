# INMO NICARAGUA

Sitio web inmobiliario profesional desarrollado con HTML, CSS y JavaScript vanilla.

## Estructura

- `index.html`
- `propiedades.html`
- `propiedad.html`
- `nosotros.html`
- `contacto.html`
- `css/styles.css`
- `js/main.js`
- `js/properties.js`
- `data/propiedades.json`

## Uso local

Abre `index.html` con un servidor estático para que la carga de JSON funcione correctamente.

Ejemplo:

```bash
python3 -m http.server 8000
```

Luego visita `http://localhost:8000`.

## GitHub Pages

Este proyecto está listo para desplegarse desde la raíz del repositorio usando GitHub Pages.

## Formato recomendado para imágenes en `data/propiedades.json`

- Usa enlaces directos que terminen en `.jpg`, `.jpeg`, `.png` o `.webp`.
- Evita URLs de Facebook (`facebook.com`, `fbcdn.net`), porque suelen bloquear la carga directa de imágenes.
- El frontend mantiene fallback automático para imágenes inválidas usando `assets/placeholder.svg`.

Ejemplo:

```json
{
  "title": "Casa moderna en Managua",
  "price": "$120,000",
  "images": [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c.jpg",
    "https://images.unsplash.com/photo-1600585154526-990dced4db0d.jpg"
  ]
}
```
