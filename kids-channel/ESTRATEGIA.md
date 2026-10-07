# Estrategia: lo más importante y cómo conseguir máxima visibilidad

## Las 5 reglas que deciden si el canal vive o muere

### 1. "Hecho para niños" es obligatorio (y cambia las reglas del juego)
Por la ley COPPA de EE. UU. y las normas de YouTube, todo contenido dirigido a niños **debe**
marcarse como "hecho para niños". El pipeline lo hace en cada subida. Marcarlo mal puede acabar en
multas y en la pérdida del canal. Consecuencias que debes conocer:
- No hay comentarios, ni campanita de notificaciones, ni anuncios personalizados (se gana menos por
  vista que en contenido para adultos; se compensa con volumen de vistas).
- El crecimiento depende casi por completo de **búsqueda y videos sugeridos**, no de la comunidad.

### 2. YouTube castiga el contenido "producido en masa"
Desde julio de 2025 la política de **contenido inauténtico** desmonetiza canales que publican videos
casi idénticos hechos con plantilla o IA sin aporte real. Automatizar está permitido; publicar
basura repetitiva, no. Cómo lo evita este sistema, y lo que te toca a ti:
- Cada episodio tiene un tema nuevo, una enseñanza concreta y una mascota propia (Lulú).
- Hay una revisión automática de calidad y seguridad antes de publicar.
- **Tú:** revisa los primeros 10-20 episodios en modo `private` antes de publicarlos, y cada mes
  mira qué funciona y ajusta las series en `canal.json`. Esa supervisión humana es tu seguro.

### 3. Calidad educativa = más alcance
YouTube y YouTube Kids promueven contenido infantil que es educativo, despierta curiosidad y
fomenta la amabilidad, y relegan lo sensacionalista, comercial o de baja calidad. Por eso el guion
invita al niño a participar (contar, repetir, responder): eso sube la retención, y la retención es
lo que el algoritmo premia.

### 4. Monetización: es una carrera larga
Para entrar al Programa de Socios necesitas **1.000 suscriptores** y **4.000 horas de visualización
pública** en 12 meses (las vistas de Shorts no cuentan para esas horas), o 1.000 suscriptores y
10 millones de vistas de Shorts en 90 días. Calcula de 3 a 9 meses publicando con constancia.

### 5. Cero problemas de derechos
Nada de personajes ajenos (Peppa, Bluey, Pocoyó…), marcas ni canciones con copyright. El guion lo
prohíbe, la música generada es propia, y si añades pistas en `assets/music/` deben ser de la
Biblioteca de audio de YouTube o tuyas.

## Lo que da máxima visibilidad (ordenado por impacto)

1. **Miniatura y título.** Es lo que decide el clic. El sistema hace miniaturas de colores fuertes,
   la mascota grande y 1-3 palabras enormes, y títulos que empiezan por lo que buscan los papás
   ("El pingüino para niños…"). **Verifica el canal por teléfono**, si no YouTube ignora la miniatura.
2. **Tiempo de visualización y sesiones largas.** Los niños ven YouTube en la tele, en sesiones
   largas y con reproducción automática. Por eso cada serie va a su propia **lista de reproducción**
   (el siguiente video se encadena solo) y cada video tiene **capítulos**. Cuando tengas 10-15
   episodios, sube `scenes_per_video` a 25-30 (6-8 min) y publica **recopilaciones de 30-60 minutos**
   uniendo episodios: es el formato que más horas suma en canales infantiles.
3. **Constancia.** 3 episodios por semana + 3 Shorts, siempre a la misma hora. El algoritmo y los
   padres se acostumbran a tu ritmo. Ya está programado.
4. **Shorts como imán.** Cada episodio genera un Short vertical con un gancho y el enlace al video
   completo. Los Shorts son la forma más rápida de que un canal nuevo aparezca.
5. **Búsqueda en español.** Hay mucha menos competencia que en inglés, con una audiencia enorme
   (Latinoamérica, España y los hispanos de EE. UU.). Descripciones con la frase clave en las dos
   primeras líneas y 12-18 etiquetas: lo hace el guion.
6. **Una mascota reconocible.** Los niños piden "el video de la lechucita". La marca crea
   espectadores que vuelven, y eso es lo que más empuja el algoritmo a largo plazo.
7. **Escuchar los datos.** A las 2-3 semanas, en YouTube Studio mira **CTR** (porcentaje de clics,
   bueno por encima del 4-5 %) y **retención media** (bueno por encima del 40-50 %). Duplica la serie
   que gane (ponla dos veces en `series`) y cambia o elimina la que pierda.

## Siguientes pasos para crecer más (cuando el canal arranque)

- **Canciones infantiles originales**: la categoría más vista de YouTube infantil, y los niños las
  ven en bucle. Se puede añadir una serie musical con una herramienta de música que dé derechos
  comerciales.
- **Recopilaciones automáticas** de 30-60 minutos con los mejores episodios.
- **Pistas de audio en otros idiomas** (inglés, portugués) en el mismo video para multiplicar la
  audiencia sin crear canales nuevos.
- **Imágenes premium** (`OPENAI_API_KEY`) y **voz premium** (`ELEVENLABS_API_KEY`) cuando haya
  ingresos: suben la calidad percibida y la retención.

## Plan de 90 días

| Semanas | Qué hacer |
|---|---|
| 1 | Configurar (ver README), lanzar 2-3 episodios a mano, revisarlos y ajustar `canal.json`. |
| 2-4 | Automático en modo `private`: revisas y publicas con un clic. Solicita la auditoría de la API de YouTube. |
| 5-8 | Con la auditoría aprobada, modo `scheduled`. Revisa CTR y retención cada semana; duplica la serie ganadora. |
| 9-13 | Episodios más largos, primera recopilación larga, y valorar la serie de canciones. |
