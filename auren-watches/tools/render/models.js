/* What each AUREN model looks like, for the renderer.
 *
 * These are art-direction parameters (sizes in millimetres of the 3D model,
 * colours, finishes), not product specifications: nothing here is published as
 * a technical fact about a watch. The product data the store shows lives in
 * content/products.json; the ids below must match its product slugs and the
 * colour/strap codes of its variants, because the image paths are built from
 * them: /img/watches/<model>-<colour>-<strap>-<angle>.webp */

const DIAL = {
  obsidian: '#121214', porcelain: '#F1F0EC', champagne: '#D7C29A', silver: '#E4E3DF',
  graphite: '#2A2B2E', black: '#0E0E10'
};

const STRAPS = {
  'piel-negra': { type: 'leather', color: '#17171A', stitch: '#2B2B2F' },
  'piel-cognac': { type: 'leather', color: '#7A4A2A', stitch: '#E8DCC6' },
  'piel-marron': { type: 'leather', color: '#3A271C', stitch: '#5A4334' },
  'caucho-negro': { type: 'rubber', color: '#141416' }
};

const MODELS = {
  'auren-one': {
    name: 'ONE',
    caseRadius: 20, caseHeight: 10.6, bezel: 'polished', lugs: 'straight', strapWidth: 20,
    hands: 'sword', indices: 'baton', layout: 'three-hand',
    colours: {
      obsidiana: { metal: 'steel', dial: DIAL.obsidian, finish: 'sunburst', print: '#E9E9E6', seconds: '#C6A56B' },
      porcelana: { metal: 'steel', dial: DIAL.porcelain, finish: 'matte', print: '#2A2A2D', seconds: '#0B0B0C', handMetal: 'steelDark' }
    },
    straps: ['piel-negra', 'piel-cognac']
  },
  'auren-chrono': {
    name: 'CHRONO',
    caseRadius: 20.5, caseHeight: 13, bezel: 'polished', lugs: 'straight', strapWidth: 20,
    hands: 'baton', indices: 'short', layout: 'chrono', pushers: true,
    colours: {
      negro: { metal: 'steel', dial: DIAL.black, finish: 'sunburst', print: '#E9E9E6', sub: '#1B1B1E', subPrint: '#D9D9D6', seconds: '#C6A56B' },
      panda: { metal: 'steel', dial: DIAL.porcelain, finish: 'matte', print: '#2A2A2D', sub: '#151517', subPrint: '#E9E9E6', seconds: '#0B0B0C', handMetal: 'steelDark' }
    },
    straps: ['caucho-negro', 'piel-negra']
  },
  'auren-classic': {
    name: 'CLASSIC',
    caseRadius: 19, caseHeight: 8.4, bezel: 'thin', lugs: 'curved', strapWidth: 19,
    hands: 'dauphine', indices: 'slim', layout: 'small-seconds',
    colours: {
      champan: { metal: 'gold', dial: DIAL.champagne, finish: 'sunburst', print: '#4A3B24', seconds: '#4A3B24' },
      plata: { metal: 'steel', dial: DIAL.silver, finish: 'sunburst', print: '#2A2A2D', seconds: '#2A2A2D', handMetal: 'steelDark' }
    },
    straps: ['piel-marron', 'piel-negra']
  },
  'auren-eclipse': {
    name: 'ECLIPSE',
    caseRadius: 21, caseHeight: 11.8, bezel: 'flat', lugs: 'straight', strapWidth: 22,
    hands: 'sword', indices: 'baton', layout: 'three-hand',
    colours: {
      eclipse: { metal: 'black', dial: DIAL.black, finish: 'matte', print: '#C6A56B', seconds: '#C6A56B', handMetal: 'gold', indexMetal: 'gold' },
      grafito: { metal: 'titanium', dial: DIAL.graphite, finish: 'sunburst', print: '#D9D9D6', seconds: '#C6A56B' }
    },
    straps: ['caucho-negro', 'piel-negra']
  }
};

module.exports = { MODELS, STRAPS };
