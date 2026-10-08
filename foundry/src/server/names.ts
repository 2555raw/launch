/** Two-word display names for guest foundries, e.g. "Medieval Parrot". */
const ADJ = ["Medieval", "Quiet", "Golden", "Rusty", "Brave", "Silent", "Molten", "Crimson", "Arctic", "Velvet", "Iron", "Amber", "Cobalt", "Lunar", "Solar", "Hollow", "Swift", "Ancient", "Electric", "Granite", "Obsidian", "Copper", "Silver", "Emerald", "Hidden", "Northern", "Wandering", "Gilded", "Smoky", "Frozen", "Burning", "Steady", "Clever", "Humble", "Mighty", "Patient", "Restless", "Sturdy", "Wild", "Zealous"];
const NOUN = ["Parrot", "Badger", "Falcon", "Otter", "Marmot", "Heron", "Lynx", "Walrus", "Beetle", "Sparrow", "Mole", "Raven", "Yak", "Ferret", "Puffin", "Weasel", "Bison", "Condor", "Gecko", "Ibex", "Jackal", "Koala", "Lemur", "Magpie", "Newt", "Osprey", "Pelican", "Quail", "Rhino", "Salmon", "Toucan", "Urchin", "Vole", "Wombat", "Finch", "Zebra", "Mantis", "Owl", "Pike", "Stoat"];

export function randomName(): string {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  return `${a} ${n}`;
}
