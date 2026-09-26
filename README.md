# EMER-NET 24 · Web de bienvenida

Web escaparate del proyecto EMER-NET 24 (X Convocatoria Dualiza 2026–2027). Una sola página con escena 3D (Three.js) guiada por el scroll: órbita → caída de la red → despliegue del nodo → red de centros → blueprint abierto → cierre.

## Probar en local

Necesitas Node 20 o superior.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # genera dist/
npm run preview   # sirve dist/ para comprobar el build
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube esta carpeta a la rama `main`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada `push` a `main` publica la web automáticamente (`.github/workflows/deploy.yml`).

La web usa rutas relativas, así que funciona en `https://usuario.github.io/<repo>/` sin configurar nada.

Para que las vistas previas en redes sociales muestren la imagen, cambia en `index.html` las dos rutas `./og-image.jpg` por la URL completa una vez publicada (por ejemplo `https://usuario.github.io/<repo>/og-image.jpg`).

## Editar contenido

| Qué | Dónde |
|---|---|
| Textos de todas las secciones | `index.html` |
| Etiquetas técnicas del despliegue (HUD) | `src/content.js` → `HUD_LABELS` |
| Posición de los centros en el mapa | `src/content.js` → `CENTERS` (latitud/longitud) |
| Colores y tipografía | `src/styles/tokens.css` |

## Cambiar o añadir logos

Los logos van en `public/logos/`. En el pie (`index.html`, bloque `.slots`) hay un hueco con el nombre de cada centro y colaborador. Para poner su logo, sustituye el `<li>Nombre</li>` por:

```html
<li><img src="./logos/nombre-del-archivo.png" alt="Nombre de la entidad" /></li>
```

Funcionan mejor en PNG con fondo transparente o blanco.

## Estructura

```
index.html            contenido (legible sin JavaScript)
src/main.js           arranque, scroll suave y estado de la página
src/scene/            escena 3D: órbita (Tierra, satélite) y terreno (nodo, torres, cúpula, blueprint)
src/sections/         loader, titulares, contadores y mapa de España
src/assets/           máscara de tierra y matriz de España (Natural Earth, dominio público), póster sin WebGL
```

Accesibilidad y rendimiento:
- Con «reducir movimiento» activado en el sistema, la web muestra los estados finales sin animaciones de cámara.
- Sin WebGL, se muestra una imagen fija en su lugar.
- En móvil se usa un nivel de calidad más ligero, sin bloom y con menos partículas.
