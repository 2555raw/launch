/* Launching with Phantom rather than with Ward's own key.
 *
 * Phantom is a browser extension and there is none here, so a stand-in is
 * injected the way test/deposit.js injects an EIP-6963 wallet. It is a real
 * signer, not a stub returning a constant: it holds an ed25519 key and signs
 * what it is given, so the assembled transaction can be verified rather than
 * merely inspected.
 *
 * The thing worth testing is the ordering. A launch needs two signatures, the
 * creator's and the brand-new mint's, and a Solana message declares the exact
 * order they must appear in. Phantom returns only its own, so Ward assembles
 * the rest around it. Get that order wrong and the network rejects the launch.
 *
 * Needs the wallet served:  PORT=8099 npm start
 *
 *   node test/phantom.js
 */
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://127.0.0.1:8099';

(async () => {
  const b = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await b.newContext({ viewport: { width: 430, height: 940 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  let fail = 0;

  await page.goto(APP + '/app#/launch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  /* A Phantom that really signs, built on the page's own ed25519. */
  await page.evaluate(async () => {
    const e = await window.WARD_SOL.parts.lib();
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const pub = await e.getPublicKeyAsync(secret);
    window.__ph = { secret, pub, calls: [] };
    window.phantom = {
      solana: {
        isPhantom: true,
        publicKey: { toString: () => window.WARD_SOL.b58encode(pub) },
        connect: async () => ({ publicKey: { toString: () => window.WARD_SOL.b58encode(pub) } }),
        disconnect: async () => {},
        on: () => {},
        request: async ({ method, params }) => {
          window.__ph.calls.push(method);
          if (method === 'signTransaction') {
            const msg = window.WARD_SOL.b58decode(params.message);
            const sig = await e.signAsync(msg, secret);
            return { signature: window.WARD_SOL.b58encode(sig) };
          }
          throw new Error('unexpected method ' + method);
        }
      }
    };
  });

  // link it
  await page.click('#lcPhantom');
  await page.waitForTimeout(500);
  const shown = await page.$eval('#lcSignerName', n => n.textContent.trim());
  console.log('1. enlazado, firma con:', shown);
  if (!/^Phantom/.test(shown)) { console.log('   no se enlazo'); fail++; }

  // with Phantom linked there is a signer, so the "need a wallet" notice goes
  const st = await page.evaluate(() => ({
    need: document.querySelector('#launchNoWallet').hidden,
    form: !document.querySelector('#launchForm').hidden,
    net: document.querySelector('#netName').textContent.trim()
  }));
  console.log('2. aviso oculto:', st.need, '| formulario visible:', st.form, '| red:', st.net);
  if (!st.need || !st.form) { console.log('   Phantom enlazado deberia bastar'); fail++; }
  if (!/solana/i.test(st.net)) { console.log('   enlazar Phantom deberia llevar a Solana'); fail++; }

  /* The ordering, exercised directly: a real message with two signers, a real
     mint key, and the submitted bytes captured instead of sent. */
  const r = await page.evaluate(async () => {
    const SOL = window.WARD_SOL, P = SOL.parts, PH = window.WARD_PHANTOM;
    const e = await P.lib();
    await PH.connect();

    const mintSecret = crypto.getRandomValues(new Uint8Array(32));
    const mintPub = await e.getPublicKeyAsync(mintSecret);
    const ix = await window.WARD_DBC.initializeIx({
      config: SOL.b58decode('11111111111111111111111111111112'),
      baseMint: mintPub, quoteMint: window.WARD_DBC.WSOL,
      creator: window.__ph.pub, payer: window.__ph.pub,
      name: 'T', symbol: 'T', uri: ''
    });
    const msg = P.buildMessage(window.__ph.pub, [ix], SOL.b58encode(crypto.getRandomValues(new Uint8Array(32))));

    let sent = null;
    const real = P.submit;
    P.submit = tx => { sent = tx; return 'captured'; };
    try { await PH.signWithOthers(msg, [{ pub: mintPub, secret: mintSecret }]); }
    finally { P.submit = real; }

    // pull the signatures back out and check each against the signer the
    // message says should be at that position
    const want = P.signersOf(msg);
    const n = sent[0];
    const ok = [];
    for (let i = 0; i < n; i++) {
      const sig = sent.slice(1 + i * 64, 1 + (i + 1) * 64);
      ok.push(await e.verifyAsync(sig, msg, want[i]));
    }
    return {
      count: n, declared: want.length, verified: ok,
      msgIntact: P.eq(sent.slice(1 + n * 64), msg),
      method: window.__ph.calls[window.__ph.calls.length - 1],
      phantomIsFirst: P.eq(want[0], window.__ph.pub)
    };
  });
  console.log('3. firmas:', r.count, 'de', r.declared, '| cada una valida:', JSON.stringify(r.verified));
  console.log('4. mensaje intacto:', r.msgIntact, '| metodo usado:', r.method, '| paga Phantom:', r.phantomIsFirst);
  if (r.count !== 2 || r.declared !== 2) { console.log('   un lanzamiento necesita dos firmas'); fail++; }
  if (!r.verified.every(Boolean)) { console.log('   UNA FIRMA NO CORRESPONDE A SU FIRMANTE'); fail++; }
  if (!r.msgIntact) { console.log('   el mensaje firmado no es el enviado'); fail++; }
  if (r.method !== 'signTransaction') { console.log('   uso el metodo que rechaza pre-firmadas'); fail++; }

  // unlinking gives the wallet back
  await page.click('#lcUnlinkPh');
  await page.waitForTimeout(400);
  const back = await page.$eval('#lcSignerName', n => n.textContent.trim());
  console.log('5. al desenlazar:', back);
  if (/Phantom/.test(back)) { console.log('   sigue enlazado'); fail++; }

  const real = errs.filter(e => !/Failed to load|net::ERR/i.test(e));
  if (real.length) { console.log('errores:', real.slice(0, 3)); fail++; }
  console.log(fail ? `\n${fail} problemas` : '\nPhantom firma, y las dos firmas van en el orden que el mensaje declara');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
