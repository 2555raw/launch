"""A fixed sample episode, so the whole render path can be tested without any API key."""


def demo_episode() -> dict:
    lines = [
        ("Inicio", "¡Hola, amiguitos! Soy Lulú. Hoy vamos a conocer a un animal que no vuela, ¡pero nada muy rápido! ¿Sabes cuál es?", "¿Quién será?"),
        ("", "¡Es el pingüino! Tiene plumas negras en la espalda y blancas en la barriga.", "Pingüino"),
        ("Dónde vive", "Muchos pingüinos viven en la Antártida, un lugar lleno de hielo y nieve. ¡Brrr, qué frío!", "Hielo"),
        ("Cómo se mueve", "En la tierra camina así: un pasito, otro pasito. ¿Puedes caminar como un pingüino?", "Un pasito"),
        ("Qué come", "El pingüino come pescaditos. Los atrapa nadando bajo el agua, ¡muy, muy rápido!", "Peces"),
        ("Un dato curioso", "Los papás pingüino emperador cuidan el huevo sobre sus patas para que no tenga frío. ¡Qué buenos papás!", "Huevo"),
        ("Adiós", "¿Te gustó conocer al pingüino? ¡Nos vemos en la próxima aventura con Lulú! ¡Adiós, amiguitos!", "¡Adiós!"),
    ]
    return {
        "topic": "El pingüino (demo)",
        "title": "El pingüino para niños 🐧 Animales del Mundo con Lulú",
        "description": "El pingüino para niños: aprende cómo es, dónde vive y qué come este animal tan simpático.\n\nDemo generada sin conexión.",
        "tags": ["pingüino para niños", "animales para niños"],
        "thumbnail_text": "¡El pingüino!",
        "thumbnail_visual": "Lulú waving next to a penguin on ice",
        "scenes": [{"chapter": c, "narration": n, "visual": f"scene {i}", "on_screen_text": t}
                   for i, (c, n, t) in enumerate(lines)],
        "short": {"title": "¿Sabías esto del pingüino? 🐧", "scene_numbers": [2, 3, 4]},
    }
