/**
 * Opiniones de EJEMPLO para el prototipo (modo demo, sin base de datos).
 * Solo se muestran mientras la tienda funciona en modo demostración; con
 * Supabase configurado salen únicamente las opiniones reales verificadas.
 * Las fechas son relativas: «hace N días, a tal hora».
 */

/** Nota global del prototipo: las opiniones con texto de abajo más valoraciones solo con estrellas. */
export const DEMO_RATING = { average: 4.8, count: 173 }

export type DemoReview = {
  product: string
  rating: 4 | 5
  title: string
  body: string
  author: string
  daysAgo: number
  /** Hora local en la que se escribió (HH:MM). */
  at: string
}

export const demoReviews: DemoReview[] = [
  { product: 'kit-ramen-casero', rating: 5, title: 'Mejor que en el japonés', body: 'Lo hice con mi hermano un viernes por la noche y flipamos. El caldo de miso sabe de verdad y el QR te lo explica todo paso a paso. Repetiremos seguro.', author: 'Lucía M.', daysAgo: 1, at: '21:14' },
  { product: 'kit-tacos-al-pastor', rating: 5, title: 'Noche de tacos en casa', body: 'La salsa de piña está brutal. Mis amigos no se creían que la soja texturizada no fuera carne.', author: 'Hugo R.', daysAgo: 1, at: '13:42' },
  { product: 'kit-wraps-crujientes', rating: 5, title: 'Mi primera receta', body: 'Tengo 13 años y nunca había cocinado nada. En 15 minutos tenía la cena hecha y sin encender el fuego. Mi madre alucinó.', author: 'Martina G.', daysAgo: 2, at: '19:05' },
  { product: 'kit-smash-burgers', rating: 5, title: 'Las mejores burgers que he hecho', body: 'Llegó todo frío y perfecto. Aplastar la carne en la plancha es lo más divertido que he hecho en la cocina. El pan brioche es otro nivel.', author: 'Álex P.', daysAgo: 2, at: '20:31' },
  { product: 'kit-onigiris-atun', rating: 4, title: 'Muy fáciles', body: 'Al principio no me salían triangulares, pero con las manos mojadas a la segunda ya sí. Perfectos para llevar al insti.', author: 'Nerea S.', daysAgo: 3, at: '17:20' },
  { product: 'kit-curry-rojo-thai', rating: 5, title: 'Picante en su punto', body: 'Le puse la mitad de pasta de curry porque a mi padre no le va el picante y quedó genial. Las cantidades vienen exactas.', author: 'Daniel F.', daysAgo: 3, at: '21:48' },
  { product: 'kit-tortitas-americanas', rating: 5, title: 'Desayuno de domingo', body: 'Solo hay que añadir agua y salen altísimas. Mi hermana pequeña ya me pide tortitas todos los fines de semana.', author: 'Carla V.', daysAgo: 4, at: '10:12' },
  { product: 'kit-penne-arrabbiata', rating: 5, title: 'Como en Roma', body: 'La salsa queda espesa y con un picante muy rico. Rápido, barato y para dos personas sobra.', author: 'Pablo L.', daysAgo: 5, at: '14:03' },
  { product: 'kit-gyozas-caseras', rating: 5, title: 'Un reto pero merece la pena', body: 'Cerrar las gyozas cuesta un poco al principio, pero las instrucciones del QR ayudan mucho. El sellado en la sartén queda crujiente por abajo, como en los restaurantes.', author: 'Sofía D.', daysAgo: 5, at: '20:57' },
  { product: 'kit-bowl-arcoiris', rating: 4, title: 'Sano y rápido', body: 'Me lo preparo para cenar después de entrenar. Los garbanzos especiados están muy buenos. Le añadiría un poco más de salsa.', author: 'Marcos T.', daysAgo: 6, at: '22:10' },
  { product: 'kit-pizza-napolitana', rating: 5, title: 'Masa de verdad', body: 'Hicimos la masa entre mi padre y yo y salió esponjosa. La mozzarella llegó fresquísima. Pizza de cumpleaños resuelta.', author: 'Irene C.', daysAgo: 7, at: '19:36' },
  { product: 'kit-butter-chicken', rating: 5, title: 'Mi plato favorito', body: 'Lo pedí para cocinar a mis padres en su aniversario. Les encantó y el naan casero es lo mejor. Se nota que es nivel 3 pero se puede.', author: 'Javier N.', daysAgo: 8, at: '18:44' },
  { product: 'kit-falafel-pita', rating: 5, title: 'Crujientes por fuera', body: 'No sabía que el falafel se podía hacer tan fácil. La salsa de tahini y los pepinillos le dan el toque.', author: 'Elena B.', daysAgo: 9, at: '13:15' },
  { product: 'kit-yakisoba', rating: 5, title: 'Wok en casa', body: 'Huele a restaurante asiático toda la casa. Las verduras frescas vienen ya cortadas en la medida justa.', author: 'Adrián M.', daysAgo: 10, at: '21:02' },
  { product: 'kit-parfait-frutos-rojos', rating: 5, title: 'Merienda top', body: 'Se monta en cinco minutos y queda precioso en un vaso. Lo hice para mis amigas y todas preguntaron dónde lo había comprado.', author: 'Paula R.', daysAgo: 11, at: '17:48' },
  { product: 'kit-tostadas-aguacate', rating: 4, title: 'Fácil y rico', body: 'El guacamole liofilizado me sorprendió, sabe a aguacate de verdad. Las semillas con chile le dan mucha gracia.', author: 'Mario G.', daysAgo: 12, at: '09:30' },
  { product: 'kit-ramen-casero', rating: 5, title: 'Lo he pedido tres veces', body: 'Ya es tradición en mi casa. Con las setas y el aceite de chile queda espectacular.', author: 'Andrea H.', daysAgo: 13, at: '20:18' },
  { product: 'caja-sorpresa', rating: 5, title: 'Regalo perfecto', body: 'Se la regalé a mi sobrino por su cumpleaños (3 meses). Cada mes me manda foto de lo que ha cocinado. Gran idea.', author: 'Cristina A.', daysAgo: 14, at: '11:52' },
  { product: 'kit-tacos-al-pastor', rating: 5, title: 'Sabor brutal', body: 'Las tortillas de maíz se calientan en un minuto en la sartén. Ideal para una peli con amigos.', author: 'Iker E.', daysAgo: 16, at: '21:25' },
  { product: 'kit-smash-burgers', rating: 5, title: 'Mi padre ya no quiere ir al burger', body: 'Lo dice él, no yo. El cheddar fundido y la salsa burger son top. Llegó en caja con frío y todo perfecto.', author: 'Lola J.', daysAgo: 18, at: '14:40' },
  { product: 'kit-wraps-crujientes', rating: 4, title: 'Para el insti', body: 'Los hago la noche antes y aguantan bien. El hummus se prepara con agua y queda cremoso.', author: 'Óscar Q.', daysAgo: 19, at: '22:05' },
  { product: 'kit-curry-rojo-thai', rating: 5, title: 'Sorprendente', body: 'Nunca había probado la leche de coco en un guiso. El arroz jazmín huele increíble. Muy bien explicado.', author: 'Valeria K.', daysAgo: 21, at: '20:09' },
  { product: 'kit-gyozas-caseras', rating: 5, title: 'Actividad de fin de semana', body: 'Las hicimos entre cuatro amigos y fue lo más divertido del sábado. Salieron 24 gyozas y no sobró ninguna.', author: 'Rubén S.', daysAgo: 23, at: '18:12' },
  { product: 'kit-penne-arrabbiata', rating: 4, title: 'Buena relación calidad-precio', body: 'Rápida y con sabor. Para mí le falta un poco de queso, pero eso ya es cosa mía.', author: 'Noa P.', daysAgo: 25, at: '13:58' },
  { product: 'kit-pizza-napolitana', rating: 5, title: 'Subí de nivel', body: 'Empecé con los wraps del nivel 1 y ya estoy haciendo pizza desde cero. Me encanta que cada kit te desbloquee el siguiente.', author: 'Leo F.', daysAgo: 27, at: '19:47' },
  { product: 'kit-onigiris-atun', rating: 5, title: 'Japón en casa', body: 'El furikake está buenísimo. Mi hermano y yo los hicimos de merienda y volaron.', author: 'Aitana R.', daysAgo: 30, at: '17:03' },
  { product: 'kit-butter-chicken', rating: 5, title: 'Restaurante indio en casa', body: 'La salsa es cremosa y especiada sin pasarse. Las instrucciones son muy claras incluso para el nivel 3.', author: 'Samuel O.', daysAgo: 33, at: '21:36' },
  { product: 'kit-tortitas-americanas', rating: 5, title: 'Esponjosas de verdad', body: 'Con el sirope y un poco de fruta quedan de foto. Las hago yo solo desde los 12.', author: 'Bruno D.', daysAgo: 36, at: '09:54' },
  { product: 'kit-yakisoba', rating: 4, title: 'Muy rico', body: 'La salsa yakisoba está muy conseguida. La próxima vez le añadiré un huevo frito encima.', author: 'Lara M.', daysAgo: 40, at: '20:41' },
  { product: 'kit-falafel-pita', rating: 5, title: 'Sin carne y nadie lo echó de menos', body: 'Lo hice para una cena con amigos vegetarianos y triunfé. El zumaque le da un toque muy especial.', author: 'Ainhoa V.', daysAgo: 44, at: '21:20' },

  // Más opiniones de ejemplo (6 por producto en total)
  { product: 'kit-wraps-crujientes', rating: 5, title: 'Cena en 10 minutos', body: 'Los martes llego tarde de baloncesto y me hago esto. Crujen un montón y no ensucias casi nada.', author: 'Gael T.', daysAgo: 6, at: '21:32' },
  { product: 'kit-wraps-crujientes', rating: 5, title: 'Perfecto para empezar', body: 'Se lo compré a mi hija de 12 años para que se animara a cocinar. Lo hizo sola y ahora quiere el siguiente nivel.', author: 'Marta S.', daysAgo: 29, at: '18:10' },
  { product: 'kit-wraps-crujientes', rating: 4, title: 'Muy ricos', body: 'El hummus está buenísimo. Para 2 personas justito si tienes mucha hambre, yo pediría el de 4.', author: 'Unai L.', daysAgo: 47, at: '14:25' },
  { product: 'kit-wraps-crujientes', rating: 5, title: 'Repetiré', body: 'Fácil, rápido y con mucho sabor. Los hice para un picnic con mis amigas y gustaron a todas.', author: 'Alba N.', daysAgo: 71, at: '12:48' },

  { product: 'kit-bowl-arcoiris', rating: 5, title: 'Colorido y sano', body: 'Queda precioso en el bol, le hice foto antes de comérmelo. Los garbanzos crujientes son lo mejor.', author: 'Laia F.', daysAgo: 4, at: '14:06' },
  { product: 'kit-bowl-arcoiris', rating: 5, title: 'Sin fuego y sin líos', body: 'Ideal para cuando estoy solo en casa y no me dejan usar la vitro. Todo viene medido.', author: 'Thiago R.', daysAgo: 17, at: '20:44' },
  { product: 'kit-bowl-arcoiris', rating: 4, title: 'Bien de cantidad', body: 'Está rico y llena bastante. La salsa me supo un poco suave, la próxima le pongo más.', author: 'Clara M.', daysAgo: 35, at: '13:39' },
  { product: 'kit-bowl-arcoiris', rating: 5, title: 'Mi madre lo flipó', body: 'Le hice la cena a mi madre el día de la madre y no se creía que lo había hecho yo.', author: 'Mateo G.', daysAgo: 58, at: '21:11' },
  { product: 'kit-bowl-arcoiris', rating: 5, title: 'Muy completo', body: 'Trae de todo y no hace falta comprar nada más. Lo recomiendo para empezar.', author: 'Julia P.', daysAgo: 88, at: '19:27' },

  { product: 'kit-parfait-frutos-rojos', rating: 5, title: 'Postre de cumple', body: 'Lo hicimos para el cumple de mi hermano en vasitos y quedó como de pastelería.', author: 'Vera C.', daysAgo: 8, at: '17:15' },
  { product: 'kit-parfait-frutos-rojos', rating: 5, title: 'Facilísimo', body: 'En cinco minutos está. La granola cruje mucho y los frutos rojos están muy ricos.', author: 'Izan D.', daysAgo: 22, at: '18:02' },
  { product: 'kit-parfait-frutos-rojos', rating: 4, title: 'Rico pero dulce', body: 'Me gustó mucho, aunque para mi gusto un pelín dulce. Con yogur natural queda perfecto.', author: 'Olivia B.', daysAgo: 41, at: '11:20' },
  { product: 'kit-parfait-frutos-rojos', rating: 5, title: 'Desayuno de finde', body: 'Ahora los sábados desayunamos esto mi padre y yo. Muy buena relación calidad-precio con la oferta.', author: 'Héctor V.', daysAgo: 63, at: '10:05' },
  { product: 'kit-parfait-frutos-rojos', rating: 5, title: 'Merienda con amigas', body: 'Lo montamos entre todas y nos encantó. Las semillas de chía le dan un toque guay.', author: 'Daniela O.', daysAgo: 95, at: '17:50' },

  { product: 'kit-tostadas-aguacate', rating: 5, title: 'Mi desayuno favorito', body: 'Las tostadas con el guacamole y las semillas están brutales. Lo hago antes de ir al insti.', author: 'Lucas E.', daysAgo: 5, at: '07:52' },
  { product: 'kit-tostadas-aguacate', rating: 5, title: 'Sorprende', body: 'No esperaba que el guacamole de sobre supiera tan bien. Mi hermano repitió dos veces.', author: 'Carmen I.', daysAgo: 19, at: '10:34' },
  { product: 'kit-tostadas-aguacate', rating: 4, title: 'Bueno y rápido', body: 'Está muy bien para un brunch. El pan de masa madre es lo que más me gustó.', author: 'Nico A.', daysAgo: 33, at: '11:58' },
  { product: 'kit-tostadas-aguacate', rating: 5, title: 'Picante suave', body: 'El chile le da un toque pero no pica demasiado. Perfecto para mí que no aguanto mucho el picante.', author: 'Ariadna L.', daysAgo: 49, at: '09:41' },
  { product: 'kit-tostadas-aguacate', rating: 5, title: 'Repetimos', body: 'Lo compramos para el domingo y ya hemos pedido otro. Muy fácil de preparar.', author: 'Jorge H.', daysAgo: 77, at: '12:16' },

  { product: 'kit-onigiris-atun', rating: 5, title: 'Como en el anime', body: 'Siempre quise hacer onigiris como en los dibujos y por fin. Me salieron perfectos a la tercera.', author: 'Kevin M.', daysAgo: 7, at: '18:37' },
  { product: 'kit-onigiris-atun', rating: 5, title: 'Para el recreo', body: 'Me hago dos por la noche y al día siguiente los llevo al insti. Todos me preguntan qué es.', author: 'Sara Y.', daysAgo: 24, at: '22:03' },
  { product: 'kit-onigiris-atun', rating: 4, title: 'Muy ricos', body: 'El furikake está genial. El arroz de microondas funciona muy bien, aunque hay que dejarlo enfriar un poco.', author: 'Pol R.', daysAgo: 45, at: '16:49' },
  { product: 'kit-onigiris-atun', rating: 5, title: 'Divertido', body: 'Lo hice con mi primo pequeño y nos lo pasamos genial dando forma a los triángulos.', author: 'Emma J.', daysAgo: 68, at: '17:30' },

  { product: 'kit-mug-cake-chocolate', rating: 5, title: 'Postre en 2 minutos', body: 'Es literalmente mezclar y al microondas. El corazón de chocolate fundido es una pasada.', author: 'Carlota S.', daysAgo: 1, at: '22:14' },
  { product: 'kit-mug-cake-chocolate', rating: 5, title: 'Peligrosamente fácil', body: 'Ya me he hecho tres esta semana. Con una bola de helado es lo más.', author: 'Marcos B.', daysAgo: 1, at: '16:47' },
  { product: 'kit-mug-cake-chocolate', rating: 5, title: 'Mi hermana alucinó', body: 'Le hice uno a mi hermana pequeña y ahora me lo pide cada tarde. Sube muchísimo en el micro.', author: 'Noelia F.', daysAgo: 2, at: '18:21' },
  { product: 'kit-mug-cake-chocolate', rating: 4, title: 'Muy rico', body: 'Sale esponjoso y con mucho chocolate. La primera vez lo dejé 10 segundos de más y quedó un poco seco, ojo.', author: 'Rayan H.', daysAgo: 3, at: '20:09' },
  { product: 'kit-mug-cake-chocolate', rating: 5, title: 'Noche de peli', body: 'Hicimos uno cada uno para ver una peli y fue el mejor plan. Súper rápido.', author: 'Inés G.', daysAgo: 4, at: '21:56' },
  { product: 'kit-mug-cake-chocolate', rating: 5, title: 'Regalo top', body: 'Lo regalé a una amiga junto con una taza bonita y le encantó la idea.', author: 'Blanca T.', daysAgo: 5, at: '13:28' },

  { product: 'kit-nachos-queso', rating: 5, title: 'Como en el cine', body: 'La salsa de queso queda cremosa de verdad. Los hicimos para ver el fútbol y volaron.', author: 'Diego P.', daysAgo: 9, at: '20:58' },
  { product: 'kit-nachos-queso', rating: 5, title: 'Fáciles y adictivos', body: 'Cinco minutos y tienes una fuente enorme de nachos. Los jalapeños le dan el punto.', author: 'Lola V.', daysAgo: 26, at: '19:40' },
  { product: 'kit-nachos-queso', rating: 4, title: 'Muy buenos', body: 'Me encantaron, aunque yo le habría puesto más maíz. El de 4 personas sale mejor de precio.', author: 'Erik S.', daysAgo: 38, at: '21:17' },
  { product: 'kit-nachos-queso', rating: 5, title: 'Fiesta de pijamas', body: 'Lo preparamos en la fiesta de pijamas de mi hija y fue un éxito total entre las niñas.', author: 'Rocío A.', daysAgo: 52, at: '22:30' },
  { product: 'kit-nachos-queso', rating: 5, title: 'Picantito', body: 'Con todos los jalapeños pica bastante, ¡pero eso me gusta! Totopos muy crujientes.', author: 'Samuel C.', daysAgo: 74, at: '18:44' },
  { product: 'kit-nachos-queso', rating: 5, title: 'Repetiremos', body: 'Muy fácil para hacerlo yo solo. Mi padre y yo ya hemos pedido otro.', author: 'Aitor M.', daysAgo: 101, at: '20:12' },

  { product: 'kit-bolitas-energeticas', rating: 5, title: 'Antes de entrenar', body: 'Me llevo un par al entrenamiento de fútbol y dan energía de verdad. Saben a bombón.', author: 'Jaime R.', daysAgo: 10, at: '16:35' },
  { product: 'kit-bolitas-energeticas', rating: 5, title: 'Sin horno', body: 'Me encanta que no haga falta cocinar nada. Salen un montón y aguantan días en la nevera.', author: 'Elsa N.', daysAgo: 21, at: '18:18' },
  { product: 'kit-bolitas-energeticas', rating: 4, title: 'Se pringa uno', body: 'Están riquísimas, pero ojo que te manchas las manos de cacao. Merece la pena.', author: 'Bruno A.', daysAgo: 37, at: '17:02' },
  { product: 'kit-bolitas-energeticas', rating: 5, title: 'Merienda sana', body: 'Mi madre está encantada porque son más sanas que las galletas, y yo también porque están buenísimas.', author: 'Zoe P.', daysAgo: 54, at: '17:45' },
  { product: 'kit-bolitas-energeticas', rating: 5, title: 'Para regalar', body: 'Las hice para regalar en Navidad en una cajita y todo el mundo me pidió la receta.', author: 'Miriam L.', daysAgo: 82, at: '12:33' },
  { product: 'kit-bolitas-energeticas', rating: 5, title: 'Fáciles', body: 'Las hace mi hermano de 10 años sin ayuda. Perfecto para empezar.', author: 'Óliver D.', daysAgo: 109, at: '19:08' },

  { product: 'kit-ramen-casero', rating: 5, title: 'Caldo brutal', body: 'El miso con el agua de las setas tiene un sabor increíble. Mejor que muchos ramen que he probado fuera.', author: 'Iván C.', daysAgo: 4, at: '21:40' },
  { product: 'kit-ramen-casero', rating: 4, title: 'Muy bueno', body: 'Está riquísimo. Yo le añadiría un huevo, pero eso ya lo pongo yo. El pack de 4 sale muy bien de precio.', author: 'Paula G.', daysAgo: 20, at: '20:26' },
  { product: 'kit-ramen-casero', rating: 5, title: 'Mi plato estrella', body: 'Ya lo he hecho para mis amigos tres veces. Siempre quedo como un chef.', author: 'Asier B.', daysAgo: 43, at: '22:01' },
  { product: 'kit-ramen-casero', rating: 5, title: 'Muy bien explicado', body: 'El vídeo del QR ayuda mucho, sobre todo para no pasarte cociendo los fideos.', author: 'Naia E.', daysAgo: 66, at: '19:14' },

  { product: 'kit-tacos-al-pastor', rating: 5, title: 'Taco Tuesday', body: 'Ahora los martes son de tacos en mi casa. La piña con el adobo es otro nivel.', author: 'Rodrigo F.', daysAgo: 3, at: '21:05' },
  { product: 'kit-tacos-al-pastor', rating: 5, title: 'Nadie notó que era soja', body: 'Mi padre es muy de carne y no se dio cuenta. Se comió cuatro tacos.', author: 'Alicia R.', daysAgo: 27, at: '21:48' },
  { product: 'kit-tacos-al-pastor', rating: 4, title: 'Ricos', body: 'Muy buen sabor. Me costó un poco calentar bien las tortillas, pero el truco del QR funciona.', author: 'Eric V.', daysAgo: 51, at: '20:37' },
  { product: 'kit-tacos-al-pastor', rating: 5, title: 'Para cumpleaños', body: 'Pedimos el de 4 con descuento para mi cumple y sobró. Todos encantados.', author: 'Lía S.', daysAgo: 84, at: '19:55' },

  { product: 'kit-tortitas-americanas', rating: 5, title: 'Esponjosas', body: 'Salen gorditas y esponjosas como en los vídeos. El sirope está muy rico.', author: 'Cayetana M.', daysAgo: 2, at: '10:40' },
  { product: 'kit-tortitas-americanas', rating: 5, title: 'Domingos felices', body: 'Mi hija de 11 años las prepara para toda la familia los domingos. Gran compra.', author: 'Raquel D.', daysAgo: 15, at: '11:22' },
  { product: 'kit-tortitas-americanas', rating: 4, title: 'Muy buenas', body: 'Las primeras me salieron un poco quemadas por tener el fuego muy alto, luego perfectas.', author: 'Hugo L.', daysAgo: 39, at: '09:47' },
  { product: 'kit-tortitas-americanas', rating: 5, title: 'Merienda con amigos', body: 'Hicimos una torre de tortitas con fruta y chocolate. Fue la merienda más épica.', author: 'Valentina C.', daysAgo: 61, at: '17:26' },

  { product: 'kit-penne-arrabbiata', rating: 5, title: 'Rapidísima', body: 'En 20 minutos tienes una pasta con mucho sabor. El picante está bien medido.', author: 'Adrián S.', daysAgo: 6, at: '14:19' },
  { product: 'kit-penne-arrabbiata', rating: 5, title: 'Mi primera pasta de verdad', body: 'Siempre había hecho pasta con tomate de bote. Esta salsa es otra cosa.', author: 'Sofía L.', daysAgo: 31, at: '21:00' },
  { product: 'kit-penne-arrabbiata', rating: 4, title: 'Buena', body: 'Rica y fácil. El de 4 personas estaba agotado cuando lo pedí, ojo.', author: 'Joel P.', daysAgo: 55, at: '13:51' },
  { product: 'kit-penne-arrabbiata', rating: 5, title: 'Como en Italia', body: 'Estuve en Roma de viaje de fin de curso y la recuerdo igual. Me encantó.', author: 'Lucía V.', daysAgo: 79, at: '20:23' },

  { product: 'kit-falafel-pita', rating: 5, title: 'Muy crujiente', body: 'Los falafel salen dorados y crujientes. La pita calentita con la salsa es la combinación perfecta.', author: 'Omar K.', daysAgo: 8, at: '20:50' },
  { product: 'kit-falafel-pita', rating: 4, title: 'Rico pero se rompen', body: 'Los primeros se me deshicieron un poco. Con las manos húmedas y la masa fría ya salen bien.', author: 'Irene T.', daysAgo: 30, at: '13:44' },
  { product: 'kit-falafel-pita', rating: 5, title: 'Cena diferente', body: 'Algo distinto a lo de siempre. Mis padres me pidieron que lo repitiera.', author: 'Tomás N.', daysAgo: 59, at: '21:29' },
  { product: 'kit-falafel-pita', rating: 5, title: 'Vegano y top', body: 'Soy vegana y por fin un kit que puedo comer entero. Gracias.', author: 'Candela M.', daysAgo: 92, at: '14:12' },

  { product: 'kit-pad-thai', rating: 5, title: 'Como en Tailandia', body: 'La salsa de tamarindo tiene el punto dulce y ácido perfecto. Los cacahuetes le dan el crunch.', author: 'Lucas F.', daysAgo: 1, at: '21:23' },
  { product: 'kit-pad-thai', rating: 5, title: 'Rápido de verdad', body: 'En 20 minutos lo tienes hecho. El tofu dorado está buenísimo, ni lo esperaba.', author: 'Marina C.', daysAgo: 2, at: '20:41' },
  { product: 'kit-pad-thai', rating: 4, title: 'Muy rico', body: 'Me encantó. Los fideos se me pegaron un poco a la sartén, la próxima uso más aceite.', author: 'Álvaro J.', daysAgo: 2, at: '14:57' },
  { product: 'kit-pad-thai', rating: 5, title: 'Mi nuevo favorito', body: 'He probado casi todos los del nivel 2 y este es mi favorito. Le eché lima y perfecto.', author: 'Mía R.', daysAgo: 3, at: '21:12' },
  { product: 'kit-pad-thai', rating: 5, title: 'Pack de 4 rentable', body: 'Pedimos el de 4 por el descuento y comimos toda la familia. Repetiremos.', author: 'Eduardo S.', daysAgo: 4, at: '20:05' },
  { product: 'kit-pad-thai', rating: 5, title: 'Huele a restaurante', body: 'Toda la casa olía a restaurante tailandés. Muy bien explicado en el QR.', author: 'Lara B.', daysAgo: 5, at: '19:38' },

  { product: 'kit-risotto-setas', rating: 5, title: 'Cremoso sin nata', body: 'No me creía que quedara tan cremoso solo removiendo. Los boletus huelen de maravilla.', author: 'Gonzalo P.', daysAgo: 11, at: '21:16' },
  { product: 'kit-risotto-setas', rating: 4, title: 'Hay que tener paciencia', body: 'Son casi 20 minutos removiendo, pero el resultado merece la pena. Muy rico.', author: 'Andrea V.', daysAgo: 28, at: '20:34' },
  { product: 'kit-risotto-setas', rating: 5, title: 'Cena especial', body: 'Lo preparé para el aniversario de mis padres y se emocionaron. Quedó como de restaurante.', author: 'Nerea L.', daysAgo: 46, at: '21:51' },
  { product: 'kit-risotto-setas', rating: 5, title: 'El parmesano', body: 'El queso que trae es de verdad, se nota. Mi abuela italiana le dio el aprobado.', author: 'Marco F.', daysAgo: 70, at: '14:02' },
  { product: 'kit-risotto-setas', rating: 5, title: 'Muy completo', body: 'Trae todo lo necesario, solo pones agua y aceite. Perfecto para aprender técnica.', author: 'Cristina R.', daysAgo: 97, at: '20:27' },
  { product: 'kit-risotto-setas', rating: 4, title: 'Bueno', body: 'Me gustó mucho, aunque yo lo dejaría un pelín más tiempo para que el arroz quede más hecho.', author: 'Pablo E.', daysAgo: 118, at: '13:36' },

  { product: 'kit-chili-sin-carne', rating: 5, title: 'Reconfortante', body: 'Perfecto para un día de lluvia. Las alubias con las especias quedan espectaculares.', author: 'Javier H.', daysAgo: 12, at: '20:48' },
  { product: 'kit-chili-sin-carne', rating: 5, title: 'Mejor al día siguiente', body: 'Hice el de 4 y me sobró para el táper del día siguiente. Más rico aún.', author: 'Sara M.', daysAgo: 25, at: '14:15' },
  { product: 'kit-chili-sin-carne', rating: 4, title: 'Pica', body: 'Con todo el sobre pica bastante. Mi hermano feliz, yo la próxima pongo la mitad.', author: 'Daniela F.', daysAgo: 44, at: '21:03' },
  { product: 'kit-chili-sin-carne', rating: 5, title: 'Con totopos', body: 'Lo serví con totopos y aguacate y triunfé con mis amigos. Ninguno echó de menos la carne.', author: 'Rubén A.', daysAgo: 62, at: '21:42' },
  { product: 'kit-chili-sin-carne', rating: 5, title: 'Fácil', body: 'Es meter todo en una cazuela y esperar. Perfecto para cuando quieres algo rico sin complicarte.', author: 'Ainara G.', daysAgo: 86, at: '19:19' },
  { product: 'kit-chili-sin-carne', rating: 5, title: 'Vegano y sabroso', body: 'Mi grupo de amigos es mitad vegano y este kit nos sirve a todos.', author: 'Leo C.', daysAgo: 113, at: '20:56' },

  { product: 'kit-curry-rojo-thai', rating: 5, title: 'Arroz jazmín top', body: 'El arroz huele increíble y la salsa de coco está muy buena. Me salió a la primera.', author: 'Esther N.', daysAgo: 9, at: '20:13' },
  { product: 'kit-curry-rojo-thai', rating: 5, title: 'Descuento en el de 4', body: 'Lo pedí de 4 para toda la familia aprovechando el descuento. Nadie dejó nada en el plato.', author: 'Ramón L.', daysAgo: 32, at: '21:24' },
  { product: 'kit-curry-rojo-thai', rating: 4, title: 'Muy bueno', body: 'Rico y con el picante justo. Las verduras frescas llegaron perfectas.', author: 'Alejandra P.', daysAgo: 57, at: '14:39' },
  { product: 'kit-curry-rojo-thai', rating: 5, title: 'Subiendo de nivel', body: 'Mi primer kit de nivel 3 y no fue tan difícil como pensaba. Muy orgulloso.', author: 'Martín G.', daysAgo: 83, at: '21:07' },

  { product: 'kit-butter-chicken', rating: 5, title: 'Salsa espectacular', body: 'La salsa de mantequilla y tomate está para mojar pan. Y el naan casero, lo mejor.', author: 'Aarón M.', daysAgo: 5, at: '21:35' },
  { product: 'kit-butter-chicken', rating: 5, title: 'Mis amigos alucinaron', body: 'Les hice la cena a mis amigos y me preguntaron si lo había pedido a domicilio.', author: 'Celia P.', daysAgo: 23, at: '22:12' },
  { product: 'kit-butter-chicken', rating: 4, title: 'Laborioso pero rico', body: 'Tiene varios pasos, pero con el QR se sigue bien. El pollo queda muy tierno.', author: 'Iker L.', daysAgo: 48, at: '20:20' },
  { product: 'kit-butter-chicken', rating: 5, title: 'El más pedido en casa', body: 'Es el kit que más hemos repetido. Ya lo hago casi sin mirar la receta.', author: 'Patricia S.', daysAgo: 76, at: '21:09' },

  { product: 'kit-gyozas-caseras', rating: 5, title: 'Plan de sábado', body: 'Hacer gyozas con amigos es lo más divertido. Salen muchísimas y crujientes por abajo.', author: 'Lorena V.', daysAgo: 13, at: '19:31' },
  { product: 'kit-gyozas-caseras', rating: 4, title: 'Requiere práctica', body: 'Las primeras quedaron feas, pero las últimas ya parecían de restaurante. Muy ricas.', author: 'Óscar B.', daysAgo: 36, at: '20:46' },
  { product: 'kit-gyozas-caseras', rating: 5, title: 'Las mejores', body: 'El relleno está muy sabroso y la salsa ponzu le va perfecta.', author: 'Julia E.', daysAgo: 65, at: '21:21' },
  { product: 'kit-gyozas-caseras', rating: 5, title: 'Reto superado', body: 'Me costó, pero el resultado es increíble. Muy satisfecho con el nivel 3.', author: 'Nil F.', daysAgo: 99, at: '19:58' },

  { product: 'kit-pizza-napolitana', rating: 5, title: 'Masa esponjosa', body: 'La masa sube muchísimo y queda con bordes inflados como en las pizzerías.', author: 'Mario T.', daysAgo: 3, at: '21:18' },
  { product: 'kit-pizza-napolitana', rating: 5, title: 'Noche de pizzas', body: 'Cada uno se hizo la suya con los ingredientes del kit. Mis primos todavía hablan de ello.', author: 'Aina R.', daysAgo: 18, at: '21:43' },
  { product: 'kit-pizza-napolitana', rating: 4, title: 'Muy buena', body: 'La mozzarella está riquísima. Mi horno no calienta mucho y tardó un poco más, pero perfecta.', author: 'David C.', daysAgo: 42, at: '20:59' },
  { product: 'kit-pizza-napolitana', rating: 5, title: 'Mi favorita', body: 'El kit que más he pedido. La albahaca fresca le da un olor buenísimo.', author: 'Helena S.', daysAgo: 73, at: '21:26' },

  { product: 'kit-yakisoba', rating: 5, title: 'Muy rápido', body: 'Lo más rápido del nivel 3. Las verduras crujientes y la salsa muy sabrosa.', author: 'Kai M.', daysAgo: 14, at: '20:31' },
  { product: 'kit-yakisoba', rating: 5, title: 'Como en Japón', body: 'Mi madre vivió en Japón y dice que sabe igual que el de los puestos callejeros.', author: 'Akemi R.', daysAgo: 34, at: '21:15' },
  { product: 'kit-yakisoba', rating: 4, title: 'Rico', body: 'Muy sabroso. Para 2 personas con mucha hambre se queda corto, pedid el de 4.', author: 'Fran G.', daysAgo: 60, at: '14:47' },
  { product: 'kit-yakisoba', rating: 5, title: 'Lo repito seguro', body: 'Fácil de hacer aunque sea nivel 3. Toda la familia encantada.', author: 'Noa D.', daysAgo: 90, at: '20:39' },

  { product: 'kit-smash-burgers', rating: 5, title: 'Costra perfecta', body: 'Aplastarlas en la sartén caliente queda increíble, con esa costra crujiente. Brutal.', author: 'Pedro A.', daysAgo: 6, at: '21:27' },
  { product: 'kit-smash-burgers', rating: 5, title: 'Pack de 4 con descuento', body: 'Lo cogimos de 4 personas por el descuento y fue la cena del sábado con mis amigos.', author: 'Nora P.', daysAgo: 13, at: '22:08' },
  { product: 'kit-smash-burgers', rating: 4, title: 'Mucho humo', body: 'Quedan buenísimas pero abre la ventana porque sale mucho humo. El pan brioche, top.', author: 'Guillermo F.', daysAgo: 25, at: '20:52' },
  { product: 'kit-smash-burgers', rating: 5, title: 'Mejor que en el burger', body: 'Doble carne con cheddar fundido. No hay nada más que decir.', author: 'Eva M.', daysAgo: 40, at: '21:34' },

  { product: 'kit-poke-salmon', rating: 5, title: 'Salmón buenísimo', body: 'El salmón llegó fresquísimo y bien frío. El bol queda precioso y está riquísimo.', author: 'Carla R.', daysAgo: 1, at: '14:22' },
  { product: 'kit-poke-salmon', rating: 5, title: 'Como en una pokería', body: 'Me encantan los pokes y este no tiene nada que envidiar a los de mi ciudad.', author: 'Adriana L.', daysAgo: 1, at: '21:01' },
  { product: 'kit-poke-salmon', rating: 5, title: 'Fresquito', body: 'Perfecto para cenar en verano. El mango con la salsa de soja combina genial.', author: 'Simón V.', daysAgo: 2, at: '21:38' },
  { product: 'kit-poke-salmon', rating: 4, title: 'Muy rico', body: 'Todo muy bueno. El arroz de sushi hay que lavarlo bien, si no queda pastoso.', author: 'Lidia C.', daysAgo: 3, at: '14:44' },
  { product: 'kit-poke-salmon', rating: 5, title: 'Sano y rico', body: 'Me lo preparo después de natación. Llena mucho y no es pesado.', author: 'Bruno S.', daysAgo: 4, at: '15:10' },
  { product: 'kit-poke-salmon', rating: 5, title: 'Bien explicado', body: 'Me daba miedo cortar el pescado crudo, pero el vídeo del QR lo explica muy bien.', author: 'Elena O.', daysAgo: 5, at: '20:17' },

  { product: 'kit-fajitas-pollo', rating: 5, title: 'Cena para compartir', body: 'Pusimos todo en el centro de la mesa y cada uno se montó la suya. Muy divertido.', author: 'Andrés M.', daysAgo: 7, at: '21:13' },
  { product: 'kit-fajitas-pollo', rating: 5, title: 'Pollo jugoso', body: 'El pollo queda jugoso y con mucho sabor por las especias. La lima le da el toque.', author: 'Paula V.', daysAgo: 23, at: '20:44' },
  { product: 'kit-fajitas-pollo', rating: 4, title: 'Muy buenas', body: 'Me encantaron. Llené demasiado la primera tortilla y se rompió, ¡el consejo del QR es verdad!', author: 'Hugo B.', daysAgo: 39, at: '21:30' },
  { product: 'kit-fajitas-pollo', rating: 5, title: 'Merece el descuento', body: 'El de 4 con descuento sale muy bien. Cenamos cuatro y sobró alguna.', author: 'Isabel G.', daysAgo: 58, at: '21:49' },
  { product: 'kit-fajitas-pollo', rating: 5, title: 'Fácil para ser nivel 3', body: 'Es de los más fáciles del nivel 3. Buen kit para pasar del 2 al 3.', author: 'Mateo R.', daysAgo: 81, at: '20:06' },
  { product: 'kit-fajitas-pollo', rating: 5, title: 'Sabor mexicano', body: 'Las especias están muy bien conseguidas. La salsa de tomate pica poquito.', author: 'Ximena T.', daysAgo: 105, at: '21:20' },

  { product: 'kit-carbonara', rating: 5, title: 'La de verdad', body: 'Nada que ver con la carbonara con nata. El guanciale crujiente y el pecorino, increíble.', author: 'Lorenzo P.', daysAgo: 8, at: '21:41' },
  { product: 'kit-carbonara', rating: 4, title: 'Ojo con el huevo', body: 'La primera vez se me cuajó un poco el huevo por tener la sartén caliente. La segunda, perfecta.', author: 'Sergio N.', daysAgo: 22, at: '14:30' },
  { product: 'kit-carbonara', rating: 5, title: 'Cremosísima', body: 'El truco del agua de la pasta funciona. Sale cremosa y sin nata.', author: 'Alba G.', daysAgo: 37, at: '21:22' },
  { product: 'kit-carbonara', rating: 5, title: 'Mi padre lloró', body: 'Vale, no lloró, pero dijo que era la mejor carbonara que había comido. Me lo apunto.', author: 'Teo M.', daysAgo: 53, at: '21:55' },
  { product: 'kit-carbonara', rating: 5, title: 'Pocos ingredientes', body: 'Solo cinco ingredientes y queda espectacular. Muy buena calidad todo.', author: 'Irene F.', daysAgo: 78, at: '14:08' },
  { product: 'kit-carbonara', rating: 5, title: 'Rápida', body: 'En 25 minutos tienes una pasta de restaurante. Ideal para cenar entre semana.', author: 'Víctor S.', daysAgo: 102, at: '20:49' },

  { product: 'caja-sorpresa', rating: 5, title: 'Cada mes una ilusión', body: 'Mi hijo espera la caja como si fuera Navidad. Le encanta no saber qué le va a tocar.', author: 'Begoña L.', daysAgo: 10, at: '18:33' },
  { product: 'caja-sorpresa', rating: 5, title: 'Recetas que no están en la tienda', body: 'Me gusta que traiga recetas exclusivas. El kit de este mes fue un pad thai buenísimo.', author: 'Claudia V.', daysAgo: 33, at: '17:12' },
  { product: 'caja-sorpresa', rating: 4, title: 'Buena idea', body: 'Muy bien pensado. Me gustaría poder elegir el nivel, pero los kits han sido muy buenos.', author: 'Fernando A.', daysAgo: 56, at: '20:28' },
  { product: 'caja-sorpresa', rating: 5, title: 'Regalo para mi nieta', body: 'Le regalé los 6 meses y cada mes me llama para contarme qué ha cocinado.', author: 'Pilar M.', daysAgo: 80, at: '12:40' },
  { product: 'caja-sorpresa', rating: 5, title: 'Sin renovación', body: 'Me gusta que no se renueve sola. Pagas, llega cada mes y listo.', author: 'Luis R.', daysAgo: 112, at: '19:47' },
]
