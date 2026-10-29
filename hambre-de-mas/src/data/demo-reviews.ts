/**
 * Opiniones de EJEMPLO para el prototipo (modo demo, sin base de datos).
 * Solo se muestran mientras la tienda funciona en modo demostración; con
 * Supabase configurado salen únicamente las opiniones reales verificadas.
 * Las fechas son relativas: «hace N días, a tal hora».
 */

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
  { product: 'kit-ramen-casero', rating: 5, title: 'Lo he pedido tres veces', body: 'Ya es tradición en mi casa. Le pongo huevo cocido como en la foto y queda espectacular.', author: 'Andrea H.', daysAgo: 13, at: '20:18' },
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
]
