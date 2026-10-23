# Anime Tracker

Aplicación web estática para registrar animes, temporadas, progreso por episodio y puntuaciones.

## Funciones

- Biblioteca persistente mediante `localStorage`.
- Estados: viendo, pendiente y completado.
- Control de progreso episodio a episodio.
- Puntuaciones, búsqueda, filtros y ordenación.
- Alta, edición y eliminación de títulos.
- Búsqueda automática de carátulas mediante la API pública de AniList.
- Diseño responsive y favicon propio.

## Desarrollo local

No requiere instalación ni proceso de build. Abre `index.html` o sirve la carpeta con cualquier servidor estático.

```bash
python -m http.server 4173
```

## Despliegue

El sitio se publica desde la rama `main` mediante GitHub Pages.
