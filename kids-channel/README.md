# Canal infantil faceless, automatizado

Cada lunes, miércoles y viernes, GitHub Actions produce y sube solo un episodio nuevo:

```
idea → guion (Claude) → revisión de seguridad infantil (Claude) → ilustraciones → voz →
música → video 16:9 con capítulos → miniatura → Short vertical → subida a YouTube
(marcado "hecho para niños", en su lista de reproducción) → registro para no repetir temas
```

La estrategia (lo que más importa y qué da visibilidad) está en [ESTRATEGIA.md](ESTRATEGIA.md).

## Qué hace cada pieza

| Paso | Archivo | Detalle |
|---|---|---|
| Guion | `pipeline/script.py` | Claude escribe el episodio de la serie que toca: escenas, título SEO, descripción, etiquetas, texto de miniatura, capítulos y qué escenas van al Short. |
| Revisión | `pipeline/script.py` | Una segunda pasada de Claude actúa de revisor de contenido infantil (datos correctos, nada que dé miedo ni sea peligroso, sin clickbait). Si rechaza, se reescribe con sus comentarios (hasta 3 intentos); si no aprueba, no se publica nada. |
| Ilustraciones | `pipeline/art.py` | Por defecto Claude dibuja cada escena en vectorial (SVG) con la mascota siempre igual. Con `OPENAI_API_KEY` usa un modelo de imagen. |
| Voz | `pipeline/voice.py` | Gratis con voces neuronales de Microsoft (`es-MX-DaliaNeural`). Con `ELEVENLABS_API_KEY`, voz más natural. |
| Música | `pipeline/music.py` | Pone pistas de `assets/music/` si las añades; si no, genera una melodía suave de caja musical. |
| Video | `pipeline/video.py` | Movimiento de cámara lento por escena, palabra grande en pantalla, música bajo la voz, volumen normalizado a -15 LUFS, capítulos automáticos. |
| Subida | `pipeline/youtube.py` | YouTube Data API: "hecho para niños", categoría Educación, miniatura, lista por serie, y el Short enlazando al episodio. |
| Automatización | `.github/workflows/kids-channel.yml` | Programado L/X/V 13:17 UTC, o manual desde la pestaña Actions. Guarda los archivos 14 días como artefacto. |

## Puesta en marcha (una sola vez, ~30 minutos)

1. **Canal de YouTube.** Créalo con una cuenta de Google y **verifícalo por teléfono** en
   youtube.com/verify. Sin eso no se pueden subir miniaturas propias, y la miniatura es lo que más
   influye en los clics.
2. **Clave de Claude.** Crea una en platform.claude.com → API keys.
3. **Acceso a YouTube.**
   1. En console.cloud.google.com crea un proyecto y activa **YouTube Data API v3**.
   2. En *Pantalla de consentimiento OAuth*: tipo Externo, añade tu correo como usuario de prueba y
      luego pulsa **Publicar aplicación** (pasar a "En producción"). Si se queda en "Prueba", el
      permiso caduca a los 7 días y las subidas dejan de funcionar.
   3. En *Credenciales* crea un **ID de cliente OAuth** de tipo *App de escritorio* y descarga el JSON.
   4. En tu computadora: `pip install google-auth-oauthlib` y
      `python tools/get_youtube_token.py client_secret.json`. Entra con la cuenta del canal.
      Te imprime `YT_CLIENT_ID`, `YT_CLIENT_SECRET` y `YT_REFRESH_TOKEN`.
4. **Secretos en GitHub.** En el repositorio: *Settings → Secrets and variables → Actions → New
   repository secret*:
   - `ANTHROPIC_API_KEY` (obligatorio)
   - `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` (para subir)
   - `ELEVENLABS_API_KEY`, `OPENAI_API_KEY` (opcionales, mejor voz / mejores imágenes)
5. **Activarlo.** Las ejecuciones programadas de GitHub solo corren desde la rama principal, así
   que fusiona esta rama en `main`. Mientras tanto puedes lanzarlo a mano: *Actions → Kids channel
   episode → Run workflow*.

### ⚠️ La auditoría de YouTube (importante para que sea 100% automático)

YouTube bloquea como **privados** los videos subidos por API desde proyectos de Google Cloud que no
han pasado su auditoría. Para publicar sin tocar nada, solicita la auditoría con el formulario
*"YouTube API Services – Audit and Quota Extension Form"* (gratis; tarda de días a semanas).
Mientras tanto:

- deja `"publish_mode": "private"` (ya viene así),
- descarga `video.mp4`, `short.mp4` y `thumbnail.jpg` del artefacto de cada ejecución en Actions y
  súbelos a mano en YouTube Studio (2 minutos; título y descripción están en `episode.json` y
  `description.txt`).

Esto además te sirve para revisar los primeros episodios, que es lo recomendable igualmente.

## Modos de publicación (`publish_mode` en `canal.json`, o al lanzar a mano)

- `private`: se sube privado; lo revisas y lo publicas tú. **Recomendado al empezar.**
- `scheduled`: se programa para la próxima `publish_hour_utc` (15 UTC = 9 a. m. en México, mediodía en Argentina, 4-5 p. m. en España).
- `public`: se publica al instante.

## Personalizar el canal (`canal.json`)

- `channel_name`, `mascot`, `style`: identidad. La mascota se describe igual en cada dibujo para que
  sea reconocible.
- `series`: los formatos. Rotan en orden; cada uno acaba en su propia lista de reproducción. Añade,
  quita o reescribe el `brief` de cada serie.
- `scenes_per_video`: 12 escenas ≈ 2-3 minutos. Súbelo a 25-30 (≈ 6-8 min) cuando veas que la
  retención aguanta.
- `voice.edge_voice`: otras voces gratis: `es-ES-ElviraNeural` (España), `es-AR-ElenaNeural`,
  `es-CO-SalomeNeural`, `es-US-PalomaNeural`.
- `make_short`: genera el Short vertical de cada episodio.

Variables de entorno opcionales: `CLAUDE_MODEL` (por defecto `claude-opus-5-5`; `claude-sonnet-5-5`
abarata), `ART_PROVIDER` (`svg` | `openai` | `basic`), `TTS_PROVIDER` (`edge` | `elevenlabs` |
`silent`).

## Probarlo en tu computadora

Requiere Python 3.11+ y ffmpeg.

```bash
cd kids-channel
pip install -r requirements.txt
python -m pipeline --demo          # sin claves: episodio de ejemplo, dibujo básico
python -m pipeline --no-upload     # episodio real con Claude, sin subirlo (necesita ANTHROPIC_API_KEY)
```

Los archivos quedan en `output/<fecha>-<tema>/`.

## Costo aproximado por episodio

| Concepto | Opción por defecto | Opción premium |
|---|---|---|
| Guion + revisión | ~0,30-0,60 USD | igual |
| Ilustraciones (13) | Claude SVG: ~1,5-4 USD | Modelo de imagen: ~0,5-1 USD, más vistoso |
| Voz | gratis | ElevenLabs desde ~5 USD/mes |
| GitHub Actions | gratis en repos públicos; 2.000 min/mes gratis en privados | |

Con 3 episodios por semana: aproximadamente 25-60 USD al mes. Son estimaciones; revisa el consumo
real en la consola de Anthropic tras las primeras ejecuciones.

Fuente tipográfica: Fredoka (SIL Open Font License, `assets/fonts/OFL.txt`).
