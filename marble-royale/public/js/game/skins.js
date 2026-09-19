/* What a marble is made of.

   Eight materials, each a real three.js material with its own light response,
   and a coin face baked onto a texture so the coin turns with the roll. The
   texture is drawn once per marble with the same routine the 2D renderer and
   the pickers use, so a DOGE is the same DOGE everywhere.

   Materials are shared per (material, colour, face) so two hundred marbles do
   not mean two hundred shader programs. */

(function () {
  'use strict';

  const MATERIALS = ['glass', 'metal', 'holo', 'neon', 'chrome', 'clear', 'lava', 'galaxy'];
  const cache = new Map();

  /* The face texture: the coin glyph on its colour, drawn on a 256 canvas and
     wrapped so the glyph sits on one hemisphere and the colour on the rest. */
  function faceTexture(THREE, color, face, material) {
    const key = 'tex:' + color + ':' + face + ':' + material;
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const ctx = cv.getContext('2d');
    if (material === 'galaxy') {
      const g = ctx.createLinearGradient(0, 0, 512, 256);
      g.addColorStop(0, '#120a2e'); g.addColorStop(0.5, color); g.addColorStop(1, '#0a1a3a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + Math.random() * 0.7) + ')';
        const r = Math.random() < 0.1 ? 2 : 1;
        ctx.fillRect(Math.random() * 512, Math.random() * 256, r, r);
      }
    } else if (material === 'lava') {
      ctx.fillStyle = '#1a0500'; ctx.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * 512, y = Math.random() * 256, r = 20 + Math.random() * 50;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, '#ffd166'); g.addColorStop(0.4, color); g.addColorStop(1, 'rgba(60,10,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      }
    } else if (material === 'holo') {
      const g = ctx.createLinearGradient(0, 0, 512, 0);
      ['#ff5ea8', '#ffd36e', '#7dff9b', '#6ee7ff', '#b98bff', '#ff5ea8'].forEach((c, i) => g.addColorStop(i / 5, c));
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = color; ctx.globalAlpha = 0.45; ctx.fillRect(0, 0, 512, 256); ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 256);
    }
    /* the coin, once on the front hemisphere */
    if (face && window.RENDER && RENDER.drawFace) {
      ctx.save();
      ctx.translate(128, 128);
      RENDER.drawFace(ctx, 0, 0, 78, face);
      ctx.restore();
      ctx.save();
      ctx.translate(384, 128);
      RENDER.drawFace(ctx, 0, 0, 78, face);
      ctx.restore();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    cache.set(key, tex);
    return tex;
  }

  /** A material for a marble. Shared when the recipe is the same. */
  /* three.js reads hex and rgb(); the server's default colours are hsl() with
     spaces, which it does not, so those go through a canvas first. */
  function toHex(color) {
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    const cv = toHex.cv || (toHex.cv = document.createElement('canvas'));
    cv.width = cv.height = 1;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function marbleMaterial(THREE, spec) {
    const material = MATERIALS.includes(spec.material) ? spec.material : 'glass';
    const color = toHex(spec.color || '#ff7a1a');
    const face = spec.face || '';
    const key = 'mat:' + material + ':' + color + ':' + face;
    if (cache.has(key)) return cache.get(key);
    const map = faceTexture(THREE, color, face, material);
    let m;
    switch (material) {
      case 'metal':
        m = new THREE.MeshStandardMaterial({ map, metalness: 0.85, roughness: 0.32 }); break;
      case 'chrome':
        m = new THREE.MeshStandardMaterial({ map, metalness: 1, roughness: 0.08, envMapIntensity: 1.6 }); break;
      case 'holo':
        m = new THREE.MeshPhysicalMaterial({ map, metalness: 0.4, roughness: 0.2, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 }); break;
      case 'neon':
        m = new THREE.MeshStandardMaterial({ map, emissive: new THREE.Color(color), emissiveIntensity: 0.9, metalness: 0.1, roughness: 0.35 }); break;
      case 'clear':
        m = new THREE.MeshPhysicalMaterial({ map, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0, clearcoat: 1, transmission: 0.6, thickness: 0.4 }); break;
      case 'lava':
        m = new THREE.MeshStandardMaterial({ map, emissive: new THREE.Color('#ff5a1a'), emissiveMap: map, emissiveIntensity: 0.7, roughness: 0.6 }); break;
      case 'galaxy':
        m = new THREE.MeshStandardMaterial({ map, emissive: new THREE.Color('#5a3bff'), emissiveMap: map, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.2 }); break;
      default: /* glass */
        m = new THREE.MeshPhysicalMaterial({ map, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, reflectivity: 0.8 });
    }
    cache.set(key, m);
    return m;
  }

  /* A material a wallet gets when it never picked one: from the address, so
     it is the same every race. */
  function materialOf(address) {
    let h = 7;
    for (let i = 0; i < address.length; i++) h = (Math.imul(h, 31) + address.charCodeAt(i)) >>> 0;
    return MATERIALS[h % MATERIALS.length];
  }

  /* Small labelled swatch for a picker, drawn without three. */
  function swatch(material, color) {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(24, 22, 3, 32, 32, 28);
    if (material === 'chrome' || material === 'metal') { g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#cfd6e6'); g.addColorStop(0.6, color); g.addColorStop(1, '#222'); }
    else if (material === 'holo') { g.addColorStop(0, '#fff'); g.addColorStop(0.3, '#ff5ea8'); g.addColorStop(0.55, '#7dff9b'); g.addColorStop(0.8, '#6ee7ff'); g.addColorStop(1, '#333'); }
    else if (material === 'neon') { g.addColorStop(0, '#fff'); g.addColorStop(0.2, color); g.addColorStop(1, color); }
    else if (material === 'clear') { g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, color); g.addColorStop(1, 'rgba(0,0,0,.3)'); }
    else if (material === 'lava') { g.addColorStop(0, '#ffd166'); g.addColorStop(0.5, '#ff5a1a'); g.addColorStop(1, '#2a0800'); }
    else if (material === 'galaxy') { g.addColorStop(0, '#fff'); g.addColorStop(0.3, '#5a3bff'); g.addColorStop(1, '#0a0a2a'); }
    else { g.addColorStop(0, '#fff'); g.addColorStop(0.25, color); g.addColorStop(1, 'rgba(0,0,0,.55)'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(32, 32, 28, 0, 6.283); ctx.fill();
    if (material === 'neon') { ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(32, 32, 26, 0, 6.283); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); }
    return cv;
  }

  window.SKINS = { MATERIALS, marbleMaterial, faceTexture, materialOf, swatch, toHex,
    LABELS: { glass: 'Glass', metal: 'Metal', holo: 'Holographic', neon: 'Neon', chrome: 'Chrome', clear: 'Clear', lava: 'Lava', galaxy: 'Galaxy' } };
})();
