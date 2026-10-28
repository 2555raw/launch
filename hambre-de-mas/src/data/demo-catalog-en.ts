/**
 * Traducción al inglés del catálogo de demostración (ver demo-catalog.ts).
 * `npm run db:seed:generate` la guarda en la columna `translations` del seed.
 */

import type { CategoryTranslation, ProductTranslation } from '@/lib/types'

export const demoCategoriesEn: Record<string, CategoryTranslation> = {
  'primer-bocado': {
    name: 'First bite',
    tagline: 'No heat or microwave only · 100% dry',
    description: 'Level 1. Everything arrives dry and ready for the cupboard: you just add water. No hob, a microwave at most.',
  },
  'con-ganas': {
    name: 'Getting hungry',
    tagline: 'Pan and pot · 100% dry',
    description: 'Level 2. Still all dry, but now you turn on the hob: pans, pots and recipes that impress. You add water and a splash of oil.',
  },
  'hambre-de-mas': {
    name: 'Hungry for more',
    tagline: 'World recipes · with fresh ingredients',
    description: 'Level 3. You can cook now: these kits also bring the fresh ingredients (meat, fish, veg, dairy) and arrive chilled.',
  },
  'caja-sorpresa': {
    name: 'Surprise box',
    tagline: 'A new kit every month',
    description: "You won't know which recipe you got until you open the box. Pay upfront for 1, 3 or 6 months.",
  },
}

const dryStorage = { label: 'Storage', value: 'Cupboard: cool, dry place. Best before: 6 months from shipping.' }
const freshStorage = { label: 'Storage', value: 'Arrives chilled. Put the fresh items in the fridge as soon as it arrives and cook within 3 days.' }
const recipeCard = { label: 'Recipe', value: 'Card with a QR code: scan it to see the step-by-step recipe on your phone.' }
const serves = (sku: string) => ({ [`${sku}-2`]: 'Serves 2', [`${sku}-4`]: 'Serves 4' })

export const demoProductsEn: Record<string, ProductTranslation> = {
  'kit-wraps-crujientes': {
    name: 'Crunchy wraps kit',
    subtitle: 'Hummus wraps with crunchy veg. No hob and no fridge.',
    description:
      'Your first recipe without turning anything on. Wheat tortillas that keep in the cupboard, hummus you make with water in a minute and freeze-dried veg that crunch like they were just cut. Roll, slice, done.',
    includes: ['6 wheat tortillas', 'Hummus sachet (chickpea and tahini)', 'Crunchy freeze-dried veg', 'Mild spice sachet', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water.' }, dryStorage, recipeCard],
    recipe: {
      youAdd: ['100 ml water'],
      steps: [
        { title: 'Make the hummus', text: 'Tip the hummus sachet into a bowl, slowly add 100 ml cold water and mix with a fork until creamy.' },
        { title: 'Wake up the veg', text: 'Open the bag of freeze-dried veg, add the spice mix and give it a shake. They stay crunchy and full of flavour.' },
        { title: 'Spread the tortillas', text: 'Spread two spoonfuls of hummus on each tortilla, leaving a finger-wide gap at the edge.' },
        { title: 'Fill and roll', text: 'Lay a strip of veg down the middle. Fold in the sides and roll up tightly.' },
        { title: 'Slice and eat', text: "Cut each wrap diagonally with a serrated knife. If you're not eating them straight away, wrap them in baking paper." },
      ],
      tips: ['If the hummus is too thick, add water a teaspoon at a time.', 'Warm the tortilla for 10 seconds in the microwave so it doesn’t crack when you roll it.'],
    },
    variants: serves('HDM-WRP'),
    imageAlts: ['Two veggie wraps cut in half', 'Ingredients on a chopping board'],
  },
  'kit-bowl-arcoiris': {
    name: 'Rainbow bowl kit',
    subtitle: 'Microwave couscous, spiced chickpeas and colourful veg.',
    description:
      'A bowl that looks amazing and comes straight from the cupboard. The couscous cooks in the microwave in five minutes, the chickpeas come cooked and ready to spice, and the freeze-dried veg bring the colour. The tahini dressing pulls it all together.',
    includes: ['Couscous', 'Cooked chickpeas (jar)', 'Toasted spice sachet', 'Freeze-dried veg', 'Tahini dressing', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water.' }, dryStorage, recipeCard],
    recipe: {
      youAdd: ['Water (same amount as the couscous)'],
      steps: [
        { title: 'Microwave couscous', text: 'Put the couscous in a microwave-safe bowl with the same volume of water and a pinch of salt. Heat for 2 minutes, cover with a plate and leave for 3.' },
        { title: 'Spice the chickpeas', text: 'Drain and rinse the chickpeas. Toss them with the toasted spices.' },
        { title: 'Rehydrate the veg', text: 'Put the veg in a glass with a little cold water for 2 minutes, then drain.' },
        { title: 'Build the bowl', text: 'Fluff the couscous with a fork as the base, then add chickpeas and veg in sections on top. Show off the colours.' },
        { title: 'Dress it', text: 'Mix the tahini dressing with two spoonfuls of water and drizzle it over.' },
      ],
      tips: ['The bowl keeps for a day in the fridge: perfect for a school lunch.'],
    },
    variants: serves('HDM-BWL'),
    imageAlts: ['Bowl with chickpeas, tomato and red cabbage', 'Colourful veg bowl seen from above'],
  },
  'kit-parfait-frutos-rojos': {
    name: 'Berry parfait kit',
    subtitle: 'Yoghurt cream you whip with water, granola and berries.',
    description:
      'Layers of yoghurt cream (it comes as a powder and you whip it with cold water), honey granola and freeze-dried berries that get all their flavour back. Four jars in ten minutes.',
    badge: 'Offer',
    includes: ['Yoghurt cream sachet', 'Honey granola', 'Freeze-dried berries', 'Chia seed sachet', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Cold water.' }, dryStorage, recipeCard],
    recipe: {
      youAdd: ['200 ml very cold water'],
      steps: [
        { title: 'Whip the cream', text: 'Mix the yoghurt cream sachet with 200 ml very cold water and whisk for 2 minutes until it thickens.' },
        { title: 'First layer', text: 'Put two spoonfuls of granola at the bottom of each glass or jar.' },
        { title: 'Cream and fruit', text: 'Add a layer of cream and some berries. Repeat until full.' },
        { title: 'Finish', text: 'Top with granola, berries and a pinch of chia.' },
      ],
      tips: ['Making it for tomorrow? Keep the granola separate so it stays crunchy.'],
    },
    variants: serves('HDM-PRF'),
    imageAlts: ['Jars of yoghurt with strawberries', 'Bowl of mixed fruit'],
  },
  'kit-tostadas-aguacate': {
    name: 'Guacamole toast kit',
    subtitle: 'Freeze-dried guacamole, crunchy bread and seeds with mild chilli.',
    description:
      'Guacamole made with freeze-dried avocado: you mix it with water and it tastes freshly made. Spread it on toasted sourdough and finish with our seed and mild chilli mix.',
    badge: 'New',
    includes: ['Toasted sourdough bread', 'Freeze-dried guacamole', 'Seed and mild chilli sachet', 'Sea salt flakes sachet', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water.' }, dryStorage, recipeCard],
    recipe: {
      youAdd: ['80 ml water', 'Optional, like in the photo: a boiled egg and a few spinach leaves'],
      steps: [
        { title: 'Make the guacamole', text: 'Tip the guacamole powder into a bowl and add 80 ml water. Mix and leave for 2 minutes to rehydrate.' },
        { title: 'Get the bread ready', text: 'Take out the toasted bread. If you like it warm, 20 seconds in the microwave.' },
        { title: 'Spread', text: 'Spread the guacamole with a spoon. Be generous.' },
        { title: 'Finish', text: 'Sprinkle with the chilli seeds and a few salt flakes. Enjoy!' },
      ],
      tips: ['For a tangy touch, add a few drops of lemon if you have some at home.'],
    },
    variants: serves('HDM-TST'),
    imageAlts: ['Avocado and egg toast (serving suggestion)'],
  },
  'kit-ramen-casero': {
    name: 'Homemade ramen kit',
    subtitle: 'Miso broth, ramen noodles and dried toppings. The one that turns you into a chef.',
    description:
      'Our star kit, and 100% cupboard food. Real ramen noodles, miso broth, dried shiitake mushrooms and spring onion, nori seaweed and chilli-sesame oil. A bowl that’s as good as your favourite restaurant’s.',
    badge: 'Best seller',
    includes: ['Ramen noodles', 'Miso broth sachet', 'Dried shiitake mushrooms', 'Freeze-dried spring onion', 'Nori seaweed', 'Chilli and sesame oil', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water.' }, dryStorage, recipeCard],
    recipe: {
      youAdd: ['1 litre water (serves 2)', 'Optional, to make it look like the photo: boiled eggs and prawns'],
      steps: [
        { title: 'Soak the mushrooms', text: 'Put the shiitake in a glass of hot tap water for 10 minutes. Keep that water: it’s full of flavour.' },
        { title: 'Make the broth', text: 'Heat the water in a pot (including the mushroom water). When it boils, turn the heat down and stir in the miso broth. Don’t let it boil hard again.' },
        { title: 'Cook the noodles', text: 'In another pot of boiling water, cook the noodles for 3 minutes. Drain and share them between the bowls.' },
        { title: 'Build the bowl', text: 'Pour the hot broth over the noodles. Add the drained mushrooms and the spring onion.' },
        { title: 'Final touch', text: 'Tuck a piece of nori at the edge of the bowl and add a few drops of chilli-sesame oil. Itadakimasu!' },
      ],
      tips: ['Cook the noodles separately so the broth stays clear.', 'Spicier: more chilli oil. Milder: sesame only.'],
    },
    variants: serves('HDM-RAM'),
    imageAlts: ['Ramen bowl with egg and prawns (serving suggestion)', 'Ramen in a dark bowl'],
  },
  'kit-tacos-al-pastor': {
    name: 'Tacos al pastor kit',
    subtitle: 'Al pastor textured soy, corn tortillas and pineapple salsa.',
    description:
      'Tacos with textured soy marinated in al pastor adobo, cooked in a pan. The texture of minced meat with no fridge needed. The kit brings the corn tortillas and a pineapple salsa with a little kick.',
    includes: ['Textured soy', 'Al pastor adobo sachet', '12 corn tortillas', 'Pineapple and chilli salsa', 'Crispy onion', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water and a splash of oil.' }, dryStorage, recipeCard],
    recipe: {
      youAdd: ['300 ml hot water', '2 tablespoons oil'],
      steps: [
        { title: 'Soak the soy', text: 'Cover the textured soy with hot water for 10 minutes. Drain it, pressing with a spoon.' },
        { title: 'Marinate', text: 'Mix the soy with the al pastor adobo and let it soak up the flavour while the pan heats.' },
        { title: 'Brown it', text: 'Pan on medium-high heat with the oil. Fry the soy for 6–8 minutes until golden at the edges.' },
        { title: 'Warm the tortillas', text: 'In the same pan, now without oil, 20 seconds each side.' },
        { title: 'Build the tacos', text: 'Tortilla, al pastor soy, pineapple salsa and crispy onion. Fold and bite.' },
      ],
      tips: ['Stack the warm tortillas wrapped in a tea towel so they don’t dry out.'],
    },
    variants: serves('HDM-TAC'),
    imageAlts: ['Plate with three veggie tacos'],
  },
  'kit-tortitas-americanas': {
    name: 'American pancakes kit',
    subtitle: 'Complete mix: just add water. Fluffy, tall and with syrup.',
    description:
      'The mix already contains powdered milk and egg, so you only add water. We show you how to control the heat of the pan so they come out golden and super tall. Includes maple syrup and chocolate chips.',
    includes: ['Complete pancake mix', 'Maple syrup', 'Chocolate chips', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water and a little oil.' }, dryStorage, recipeCard],
    recipe: {
      youAdd: ['250 ml water', 'A few drops of oil'],
      steps: [
        { title: 'Make the batter', text: 'Whisk the pancake mix with 250 ml water. Leave a few small lumps: that’s what makes them fluffy.' },
        { title: 'Rest', text: 'Leave the batter for 5 minutes while the pan heats on medium-low.' },
        { title: 'Grease lightly', text: 'A few drops of oil spread with kitchen paper. The pan should shine, not have a puddle.' },
        { title: 'First flip', text: 'Pour in a ladle of batter. When bubbles appear on top (1–2 minutes), flip it.' },
        { title: 'Stack and decorate', text: 'One more minute and onto the tower. Finish with syrup and chocolate chips.' },
      ],
      tips: ['The first pancake almost never works: it’s the test one.', 'Burnt outside and raw inside? Turn the heat down.'],
    },
    variants: serves('HDM-TRT'),
    imageAlts: ['Stack of pancakes with banana and syrup', 'French toast with blueberries and banana'],
  },
  'kit-penne-arrabbiata': {
    name: "Penne all'arrabbiata kit",
    subtitle: 'Rome’s most famous spicy tomato sauce.',
    description:
      'Durum wheat penne rigate, Italian chopped tomatoes and our mix of chilli and dried garlic. You learn to fry gently without burning and to bind the sauce with pasta water, the Italian way.',
    includes: ['Penne rigate', 'Italian chopped tomatoes (carton)', 'Chilli and garlic sachet', 'Parsley sachet', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water and olive oil.' }, dryStorage, recipeCard],
    recipe: {
      youAdd: ['2 litres water', '3 tablespoons olive oil'],
      steps: [
        { title: 'Boil the water', text: 'Bring 2 litres of water with a tablespoon of salt to the boil in a big pot.' },
        { title: 'The base', text: 'In a pan, warm the oil on low heat with the garlic and chilli for 1 minute. If the garlic gets too dark, it turns bitter.' },
        { title: 'Sauce', text: 'Add the chopped tomatoes and cook for 10 minutes on medium heat, stirring now and then.' },
        { title: 'Pasta', text: 'Cook the penne for the packet time minus one minute. Before draining, save half a glass of the cooking water.' },
        { title: 'Bring it together', text: 'Add the pasta to the sauce with a splash of the saved water and stir on high heat for 1 minute until glossy. Parsley, and serve.' },
      ],
      tips: ['Pasta water is full of starch: that’s what makes the sauce stick.'],
    },
    variants: serves('HDM-PEN'),
    imageAlts: ['Plate of penne with tomato sauce', 'Pan with pasta'],
  },
  'kit-curry-rojo-thai': {
    name: 'Red salmon curry kit',
    subtitle: 'Fresh salmon in Thai red curry with coconut milk and jasmine rice.',
    description:
      'A trip to Bangkok in 35 minutes. Level 3: the kit brings the fresh salmon and lemon, plus red curry paste, coconut milk, jasmine rice and herbs. You learn to sear fish without it falling apart and to balance sweet, salty, sour and spicy.',
    badge: 'New',
    includes: ['Fresh salmon fillets', 'Lemon', 'Red curry paste', 'Coconut milk', 'Jasmine rice', 'Fresh oregano', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water and oil.' }, freshStorage, recipeCard],
    recipe: {
      youAdd: ['Water for the rice', '1 tablespoon oil'],
      steps: [
        { title: 'Jasmine rice', text: 'Rinse the rice under the tap until the water runs clear. Cook it with 1.5 times its volume of water, covered, on low heat for 12 minutes. Rest for 5.' },
        { title: 'Dry the salmon', text: 'Take the salmon out of the fridge, pat it very dry with kitchen paper and add a pinch of salt. Dry fish browns better and doesn’t spit.' },
        { title: 'Sear the salmon', text: 'Pan on medium-high heat with the oil. Place the fillets skin side down for 3 minutes without moving them, flip for 1 minute and set aside on a plate.' },
        { title: 'The sauce', text: 'In the same pan, lower the heat and stir the curry paste for 1 minute. Add the coconut milk and cook for 5 minutes until it thickens slightly.' },
        { title: 'Bring it together', text: 'Return the salmon to the sauce for 4 minutes on gentle heat. It’s ready when it flakes when you touch it with a fork.' },
        { title: 'Serve', text: 'A few lemon slices and the fresh oregano on top, with the rice on the side.' },
      ],
      tips: ['Move the salmon as little as possible: if you keep touching it, it breaks.', 'Too spicy? Add more coconut milk.'],
    },
    variants: serves('HDM-CUR'),
    imageAlts: ['Salmon fillets in red curry sauce with lemon slices', 'Pan of curry with fresh herbs'],
  },
  'kit-butter-chicken': {
    name: 'Butter chicken with naan kit',
    subtitle: 'Fresh chicken in a tomato, butter and garam masala sauce.',
    description:
      'The Indian dish everybody loves. It arrives chilled with the chicken thighs, yoghurt, cream and butter, plus spices, tomato and the mix to make naan in a pan. Level 3 because you juggle three things at once.',
    includes: ['Fresh chicken thighs', 'Plain yoghurt, cream and butter', 'Garam masala and marinade spice sachets', 'Tomato purée', 'Naan mix', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water.' }, freshStorage, recipeCard],
    recipe: {
      youAdd: ['120 ml water (for the naan)'],
      steps: [
        { title: 'Marinate the chicken', text: 'Cut the chicken into pieces and mix with half the yoghurt and the marinade spices. Leave in the fridge for 15 minutes.' },
        { title: 'Naan dough', text: 'Mix the naan flour with the rest of the yoghurt and 120 ml water. Knead for 3 minutes and leave to rest, covered.' },
        { title: 'Brown the chicken', text: 'Hot pan with half the butter. Brown the chicken for 6 minutes and take it out.' },
        { title: 'The sauce', text: 'In the same pan, the rest of the butter, the tomato and the garam masala for 3 minutes. Add the cream and return the chicken for 10 minutes on gentle heat.' },
        { title: 'Pan naan', text: 'Divide the dough into balls, roll them thin and cook in a very hot dry pan, 1 minute each side, until they bubble.' },
        { title: 'Serve', text: 'Butter chicken in a bowl and hot naan on the side for dipping.' },
      ],
      tips: ['With three things going at once, get everything ready before you turn on the hob.'],
    },
    variants: serves('HDM-BTC'),
    imageAlts: ['Butter chicken with naan bread', 'Bowls of Indian curry with rice'],
  },
  'kit-gyozas-caseras': {
    name: 'Homemade gyoza kit',
    subtitle: 'Fresh wrappers, pork and cabbage filling, and ponzu sauce.',
    description:
      'The level 3 challenge: sealing gyozas with their pleats. It arrives chilled with the wrappers, minced pork and cabbage, plus filling spices and ponzu sauce for dipping. We teach you the pleat and the steam-and-fry technique.',
    badge: 'New',
    includes: ['30 gyoza wrappers', 'Fresh minced pork', 'Fresh cabbage and spring onion', 'Filling spice sachet', 'Ponzu sauce', 'Sesame oil', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water and oil.' }, freshStorage, recipeCard],
    recipe: {
      youAdd: ['A small glass of water', '1 tablespoon oil'],
      steps: [
        { title: 'Filling', text: 'Chop the cabbage and spring onion very finely. Mix with the meat and spices into a paste.' },
        { title: 'Fill', text: 'Put a teaspoon of filling in the centre of each wrapper and wet the edge with a damp finger.' },
        { title: 'The pleat', text: 'Fold in half and, starting at one end, make 5 or 6 pleats on the front side, pressing against the back.' },
        { title: 'Brown', text: 'Pan with oil on medium heat. Stand the gyozas up and brown the bottoms for 2 minutes.' },
        { title: 'Steam', text: 'Pour in half a glass of water and cover straight away (watch out for splashes!). Cook for 6 minutes until the water evaporates.' },
        { title: 'Serve', text: 'Crispy side up, with ponzu and sesame for dipping.' },
      ],
      tips: ['The first ones look ugly: by the tenth they’ll be perfect.', 'You can freeze them raw and cook them another day.'],
    },
    variants: serves('HDM-GYO'),
    imageAlts: ['Steamed gyozas in a bamboo steamer'],
  },
  'kit-pizza-napolitana': {
    name: 'Neapolitan pizza kit',
    subtitle: 'Slow-proved dough, fresh mozzarella and basil.',
    description:
      'Type 00 flour, yeast and San Marzano tomatoes, plus the fresh stuff: fior di latte mozzarella and basil. Stretch by hand, bake at full power and get a puffy, charred crust.',
    includes: ['Type 00 flour', 'Dried yeast sachet', 'San Marzano tomatoes', 'Fresh fior di latte mozzarella', 'Fresh basil', 'Recipe card with QR'],
    specs: [
      { label: 'You add', value: 'Warm water and olive oil.' },
      { label: 'Proving time', value: 'The dough needs 8 to 24 hours resting in the fridge.' },
      freshStorage,
      recipeCard,
    ],
    recipe: {
      youAdd: ['300 ml warm water', '1 tablespoon olive oil'],
      steps: [
        { title: 'The dough (the day before)', text: 'Mix the flour, yeast, a teaspoon of salt and the warm water. Knead for 10 minutes until smooth, shape into balls and keep them covered in the fridge for 8 to 24 hours.' },
        { title: 'Bring to room temperature', text: 'Take the balls out of the fridge 1 hour before and heat the oven to maximum with the tray inside.' },
        { title: 'Stretch by hand', text: 'Press the ball from the centre outwards, leaving a thick edge. No rolling pin: it would squash the air out.' },
        { title: 'Top it', text: 'Tomatoes crushed by hand, drained and torn mozzarella, a drizzle of oil.' },
        { title: 'Bake', text: 'On the hot tray, 7–9 minutes until the crust is puffed up with charred spots.' },
        { title: 'Basil', text: 'Out of the oven, add a few fresh basil leaves. Slice and share (or don’t).' },
      ],
      tips: ['Use oven gloves to take the tray out: it’s scorching.'],
    },
    variants: { 'HDM-PIZ-2': '2 pizzas', 'HDM-PIZ-4': '4 pizzas' },
    imageAlts: ['Freshly baked margherita pizza', 'Pizza cut into slices'],
  },
  'kit-yakisoba': {
    name: 'Yakisoba kit',
    subtitle: 'Wok-fried noodles with fresh veg and yakisoba sauce.',
    description:
      'Wheat noodles stir-fried on high heat with fresh veg (cabbage, carrot, pepper and onion, all included) and homemade-style yakisoba sauce. You learn stir-frying: everything cut first, a very hot pan and constant movement.',
    includes: ['Wheat noodles', 'Fresh cabbage, carrot, pepper and onion', 'Yakisoba sauce', 'Ginger', 'Toasted sesame sachet', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water and oil.' }, freshStorage, recipeCard],
    recipe: {
      youAdd: ['Water for the noodles', '2 tablespoons oil'],
      steps: [
        { title: 'Cut everything first', text: 'Cabbage in strips, carrot in thin sticks, pepper and onion in strips. Stir-frying is so fast there’s no time later.' },
        { title: 'Noodles', text: 'Cook for 3 minutes, drain and rinse under cold water so they don’t stick.' },
        { title: 'Very hot pan', text: 'Oil on high heat. Stir-fry the onion and carrot for 2 minutes, keeping everything moving.' },
        { title: 'The rest of the veg', text: 'Add the cabbage, pepper and ginger. 2 more minutes: they should stay crunchy.' },
        { title: 'All together', text: 'Noodles and yakisoba sauce. Toss for 1 minute on high heat and finish with toasted sesame.' },
      ],
      tips: ['If your pan is small, do it in two batches: overcrowded veg steam instead of frying.'],
    },
    variants: serves('HDM-YAK'),
    imageAlts: ['Stir-fried noodles on a black plate', 'Bowl of noodles with lime and veg'],
  },
  'kit-onigiris-atun': {
    name: 'Tuna onigiri kit',
    subtitle: 'Japanese rice balls with tuna, mayo and furikake. Microwave only.',
    description:
      "Japan's favourite snack, without turning on the hob. Ready-cooked Japanese rice you warm in the microwave, tinned tuna, mayo and furikake (sesame and seaweed) to coat them. Shape them into triangles with your hands and wrap them in nori.",
    badge: 'New',
    includes: ['Cups of ready-cooked Japanese rice', 'Tin of tuna in water', 'Mayonnaise sachet', 'Furikake sachet (sesame and seaweed)', 'Nori seaweed sheets', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Nothing: just a microwave.' }, dryStorage, recipeCard],
    recipe: {
      youAdd: ['Nothing: just a microwave and a little water to wet your hands'],
      steps: [
        { title: 'Warm the rice', text: 'Peel back the lid of the rice cups a little and microwave for 1 minute. Let it cool slightly so you don’t burn yourself.' },
        { title: 'Make the filling', text: 'Drain the tuna and mix it in a bowl with the mayo.' },
        { title: 'Shape the onigiri', text: 'Wet your hands, take a handful of rice, make a dip in the middle, add a spoonful of filling and close it, pressing into a triangle.' },
        { title: 'Coat them', text: 'Roll the sides in the furikake so the sesame and seaweed stick.' },
        { title: 'Wrap', text: 'Put a strip of nori around the base just before eating so it stays crunchy.' },
      ],
      tips: ['With wet hands the rice won’t stick.', 'For a school lunch, wrap each onigiri in cling film and add the nori when you eat.'],
    },
    variants: serves('HDM-ONI'),
    imageAlts: ['Onigiri coated in furikake on a sheet of seaweed (serving suggestion)', 'Hands holding an onigiri wrapped in seaweed'],
  },
  'kit-falafel-pita': {
    name: 'Falafel and pita kit',
    subtitle: 'Crispy pan-fried falafel, pita bread, tahini sauce and pickles.',
    description:
      'The falafel mix has chickpeas, herbs and spices: just add water, shape the balls and fry them in a pan. Fill the pita with the falafel, tahini sauce, pickles and a pinch of sumac. All from the cupboard.',
    badge: 'New',
    includes: ['Falafel mix (chickpeas, herbs and spices)', 'Pita bread', 'Tahini sauce sachet', 'Pickled gherkins', 'Sumac sachet', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'Water and oil.' }, dryStorage, recipeCard],
    recipe: {
      youAdd: ['150 ml water', '4 tablespoons oil'],
      steps: [
        { title: 'Hydrate the mix', text: 'Mix the falafel with 150 ml water and leave for 10 minutes: you want a dough you can shape.' },
        { title: 'Shape the balls', text: 'With damp hands, make walnut-sized balls and flatten them slightly.' },
        { title: 'Fry them', text: 'Pan with the oil on medium heat. Fry the falafel for 3 minutes each side and drain on kitchen paper.' },
        { title: 'Warm the bread', text: 'A few seconds in the dry pan so it opens more easily.' },
        { title: 'Fill', text: 'Open the pita and add 3 or 4 falafel, tahini sauce, gherkins and a pinch of sumac.' },
      ],
      tips: ['If the dough falls apart, add another teaspoon of the dry mix.', 'Don’t move them until they’re golden: that way they don’t break.'],
    },
    variants: serves('HDM-FAL'),
    imageAlts: ['Golden falafel, one split in half', 'Bowl of falafel with pickles (serving suggestion)'],
  },
  'kit-smash-burgers': {
    name: 'Smash burgers kit',
    subtitle: 'Fresh beef smashed on a hot pan, melted cheddar and brioche buns.',
    description:
      'The burger everyone’s talking about: balls of fresh beef smashed in a very hot pan for a crispy crust. It arrives chilled with the beef, cheddar, brioche buns and onion, plus pickles, burger sauce and a salt and pepper sachet.',
    badge: 'New',
    includes: ['Fresh minced beef', 'Brioche buns', 'Cheddar slices', 'Fresh red onion', 'Pickled gherkins', 'Burger sauce sachet', 'Salt and pepper sachet', 'Recipe card with QR'],
    specs: [{ label: 'You add', value: 'A splash of oil.' }, freshStorage, recipeCard],
    recipe: {
      youAdd: ['1 tablespoon oil'],
      steps: [
        { title: 'Make the balls', text: 'Split the beef into equal balls (2 per burger). Don’t knead it: the less you handle it, the juicier it stays.' },
        { title: 'Get everything ready', text: 'Slice the onion into very thin rings, open the buns and have the cheese at hand: it all goes fast after this.' },
        { title: 'Toast the buns', text: 'Hot pan, no oil: toast the cut side of the buns for 1 minute and set aside.' },
        { title: 'Smash', text: 'Turn the heat to max with a splash of oil. Add the balls and press them flat with a spatula. Salt and pepper.' },
        { title: 'Flip and cheese', text: 'After 2 minutes, when they have a crust, flip them, put the cheddar on top and cook 1 more minute.' },
        { title: 'Build', text: 'Bun, burger sauce, two cheesy patties, onion, gherkins and the lid. Dig in!' },
      ],
      tips: ['The pan has to be really hot: if it isn’t smoking a little, wait.', 'Wash your hands after touching raw meat.'],
    },
    variants: serves('HDM-SMB'),
    imageAlts: ['Double smash burger with cheddar and gherkins', 'Double cheeseburger in a sesame bun'],
  },
  'caja-sorpresa': {
    name: 'Surprise box',
    subtitle: "A new kit every month. You won't know which until you open the box.",
    description:
      "Every month we send a different kit with recipes that aren't in the shop. The 1- and 3-month boxes are level 1 and 2 (100% dry); the 6-month box includes a level 3 kit with fresh ingredients. You pay upfront and get it in the first week of each month. It doesn't renew automatically.",
    includes: ['One surprise kit a month', 'Exclusive QR recipe', 'Collectable level sticker'],
    specs: [
      { label: 'Deliveries', value: 'The first week of each month, to the same address.' },
      { label: 'Renewal', value: 'No automatic renewal.' },
      { label: 'Allergens', value: 'Depend on the kit. We email you before each delivery.' },
    ],
    recipe: {
      youAdd: ['Depends on the kit of the month'],
      steps: [
        { title: 'Open the box', text: 'Inside you’ll find the kit of the month and its card with its own QR code.' },
        { title: 'Scan its QR', text: 'Every surprise kit comes with its own step-by-step recipe.' },
        { title: 'Collect them', text: 'Stick the level sticker on your progress card.' },
      ],
      tips: ['If you have an allergy, tell us when you order and we’ll adapt the box.'],
    },
    variants: { 'HDM-SRP-1': '1 month', 'HDM-SRP-3': '3 months', 'HDM-SRP-6': '6 months' },
    imageAlts: ['Table full of ingredients, fruit and spices', 'Assorted dishes with spices'],
  },
}
