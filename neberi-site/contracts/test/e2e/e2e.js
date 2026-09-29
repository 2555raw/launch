// End-to-end test of the Nebari site in a real Chromium, against a local chain with the
// real Uniswap v4 PoolManager and the Nebari contracts. A mock EIP-1193 wallet signs with
// the chain's first unlocked account.
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const BASE = 'http://127.0.0.1:8767';
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'deployed.json'), 'utf8'));
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = []; const errors = [];
const pass = (m) => { results.push(['ok', m]); console.log('  ok  ', m); };
const fail = (m) => { results.push(['FAIL', m]); console.log('  FAIL', m); };

const WALLET = `(() => {
  const ACCOUNT = '${D.deployer}';
  const RPC = '${BASE}/rpc';
  let id = 0;
  const call = async (method, params) => {
    const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params || [] }) });
    const j = await r.json();
    if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
    return j.result;
  };
  window.__txs = [];
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts': case 'eth_accounts': return [ACCOUNT];
        case 'eth_chainId': return '0x1237';
        case 'net_version': return '4663';
        case 'wallet_switchEthereumChain': case 'wallet_addEthereumChain': return null;
        case 'eth_sendTransaction': { const h = await call(method, params); window.__txs.push(h); return h; }
        default: return call(method, params);
      }
    },
    on: () => {}, removeListener: () => {},
  };
  try { localStorage.setItem('nebari:cookies', 'accepted'); localStorage.setItem('nebari:wallet', '1'); } catch (e) {}
})();`;

(async () => {
  const chrome = spawn(process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=9555', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let tab; for (let i = 0; i < 40 && !tab; i++) { await sleep(300); try { tab = await (await fetch('http://127.0.0.1:9555/json/new?about:blank', { method: 'PUT' })).json(); } catch (_) {} }
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => ws.onopen = r);
  let id = 0; const pending = {};
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending[d.id]) return pending[d.id](d);
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error: ' + d.params.args.map((a) => a.value || a.description).join(' '));
  };
  const send = (method, params) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: WALLET });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval error'); return r.result.result.value; };
  const go = async (url) => { await send('Page.navigate', { url: BASE + url }); await sleep(1500); };
  const waitFor = async (expr, ms = 30000, label = expr) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch (_) {} await sleep(400); } throw new Error('timeout: ' + label); };
  const text = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent||''`);
  const setVal = (sel, v) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  const click = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.click(); return true; })()`);
  const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(s.result.data, 'base64')); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { fail(name + ' -> ' + e.message); try { await shot('FAIL-' + name.replace(/\W+/g, '_')); } catch (_) {} } };

  async function launchAndTrade(label, pairAddr, name, symbol, price, buyAmount, sellAmount) {
    let tokenAddr;
    await step(`${label}: launch`, async () => {
      await go('/launch.html?pair=' + pairAddr);
      await waitFor(`document.querySelectorAll('.pick').length > 0`, 15000, 'picks rendered');
      await waitFor(`!!document.querySelector('.pick.selected')`, 15000, 'pair preselected from the URL');
      pass(`${label}: pair preselected (${await text('#s-pair')})`);
      await setVal('#name', name); await setVal('#symbol', symbol); await setVal('#price', price);
      await sleep(300);
      pass(`${label}: summary shows ${await text('#s-price')} start, cap ${await text('#s-cap')}`);
      await shot(label + '-1-launch-form');
      await click('#launch');
      await waitFor(`/Launched/.test(document.getElementById('status').textContent)`, 45000, 'launch confirmed');
      pass(`${label}: launch transaction confirmed`);
      await waitFor(`location.pathname.endsWith('token.html')`, 15000, 'redirect to the token page');
      tokenAddr = await ev(`new URLSearchParams(location.search).get('token')`);
      pass(`${label}: token page opened for ${tokenAddr}`);
    });
    if (!tokenAddr) return null;
    await step(`${label}: token page`, async () => {
      await waitFor(`document.getElementById('t-name').textContent !== 'Loading…'`, 20000, 'token loaded');
      pass(`${label}: name "${await text('#t-name')}", price ${await text('#k-price')}, floor ${await text('#k-floor')}, cap ${await text('#k-cap')}`);
      await waitFor(`/USDG|ETH|${symbol}/.test(document.getElementById('y-bal').textContent)`, 15000, 'wallet balance shown');
      await shot(label + '-2-token');
    });
    await step(`${label}: buy`, async () => {
      await setVal('#amount', buyAmount);
      await waitFor(`/You receive/.test(document.getElementById('quote').textContent)`, 20000, 'buy quote');
      pass(`${label}: quote "${await text('#quote')}"`);
      const before = await text('#y-bal');
      await click('#swap');
      await waitFor(`/^Done/.test(document.getElementById('trade-status').textContent)`, 60000, 'buy confirmed');
      if ((await text('#y-bal')) === before) throw new Error('balance not refreshed when Done appeared');
      pass(`${label}: buy confirmed, balance now ${await text('#y-bal')}, price ${await text('#k-price')}, volume ${await text('#k-vol')}`);
      await shot(label + '-3-bought');
    });
    await step(`${label}: sell`, async () => {
      await click('.tab[data-side="sell"]');
      await sleep(800);
      await setVal('#amount', sellAmount);
      await waitFor(`/You receive/.test(document.getElementById('quote').textContent)`, 20000, 'sell quote');
      pass(`${label}: sell quote "${await text('#quote')}"`);
      await click('#swap');
      await waitFor(`/^Done/.test(document.getElementById('trade-status').textContent)`, 90000, 'sell confirmed (approve + swap)');
      pass(`${label}: sell confirmed, balance now ${await text('#y-bal')}, price ${await text('#k-price')}`);
    });
    await step(`${label}: collect fees`, async () => {
      await click('#collect');
      await waitFor(`/^Collected/.test(document.getElementById('claim-status').textContent)`, 60000, 'fees collected');
      pass(`${label}: "${(await text('#claim-status')).split('Half')[0].trim()}", claimable ${await text('#y-claim')}, paid to holders ${await text('#k-dist')}, supply left ${await text('#k-supply')}`);
    });
    await step(`${label}: claim`, async () => {
      await waitFor(`!/^0 /.test(document.getElementById('y-claim').textContent)`, 15000, 'something to claim');
      await click('#claim');
      await waitFor(`/^Claimed/.test(document.getElementById('claim-status').textContent)`, 60000, 'claim confirmed');
      await waitFor(`/^0 /.test(document.getElementById('y-claim').textContent)`, 15000, 'claimable back to zero');
      pass(`${label}: claim confirmed, claimed so far ${await text('#y-claimed')}`);
      await shot(label + '-4-claimed');
    });
    return tokenAddr;
  }

  console.log('\nhome page');
  await step('home: loads', async () => {
    await go('/index.html');
    await waitFor(`document.querySelectorAll('.banner-asset').length > 0`, 10000, 'banner logos');
    await sleep(2500);
    pass(`home: banner shows the picks that exist on this chain: ${await ev(`[...document.querySelectorAll('.banner-sym')].map(e=>e.textContent).join(', ')`)}`);
    await waitFor(`document.querySelector('[data-live-count]').textContent === '0'`, 15000, 'launch counter');
    pass('home: launch counter reads 0 from the factory');
    await sleep(2500);
    pass(`home: quick picks after on-chain check: ${await ev(`[...document.querySelectorAll('#assets-grid .asset-sym')].map(e=>e.textContent).join(', ')`)}`);
    await shot('0-home');
  });

  console.log('\nETH pair');
  const t1 = await launchAndTrade('eth', '0x0000000000000000000000000000000000000000', 'Sakura Test', 'SKT', '0.000000001', '0.05', '1000000');
  console.log('\nUSDG pair (6 decimals, ERC20 approvals)');
  const t2 = await launchAndTrade('usdg', D.testToken, 'Dollar Seed', 'DSD', '0.00001', '25', '100000');

  console.log('\nexplore, claim, home');
  await step('explore', async () => {
    await go('/explore.html');
    await waitFor(`document.querySelectorAll('.tree-card').length === 2`, 20000, 'two tokens in the garden');
    pass(`explore: ${await ev(`[...document.querySelectorAll('.tree-card h3')].map(e=>e.textContent).join(', ')`)}`);
    await shot('5-explore');
  });
  await step('claim page', async () => {
    await go('/claim.html');
    await waitFor(`document.querySelectorAll('#list tbody tr').length === 2`, 20000, 'two rows on the claim page');
    pass(`claim page: ${await ev(`[...document.querySelectorAll('#list tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' ').trim()).join(' | ')`)}`);
    await shot('6-claim');
  });
  await step('home: counter', async () => {
    await go('/index.html');
    await waitFor(`document.querySelector('[data-live-count]').textContent === '2'`, 15000, 'counter reads 2');
    pass('home: launch counter reads 2');
  });
  await step('cookie gate', async () => {
    await ev(`localStorage.removeItem('nebari:cookies'); true`);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.removeItem('nebari:cookies') } catch (e) {}` });
    await go('/index.html');
    await waitFor(`!!document.getElementById('ng-leave')`, 8000, 'cookie gate shown');
    pass('cookie gate: shown on a fresh visit');
    await click('#ng-leave'); await sleep(1500);
    const where = await ev('location.href');
    where.includes('ponsfamily.com/launchpad') || where.startsWith('chrome-error') ? pass('cookie gate: Decline leaves for ' + (where.startsWith('chrome-error') ? 'ponsfamily.com/launchpad (blocked here, navigation attempted)' : where)) : fail('cookie gate: Decline went to ' + where);
  });

  const real = errors.filter((e) => !/fonts\.g|google\.com|duckduckgo|ERR_|net::|Failed to load resource/i.test(e));
  console.log(`\n${results.filter((r) => r[0] === 'ok').length} passed, ${results.filter((r) => r[0] === 'FAIL').length} failed`);
  console.log(real.length ? 'page errors:\n  ' + real.slice(0, 12).join('\n  ') : 'no page errors');
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ results, errors: real, tokens: [t1, t2] }, null, 2));
  ws.close(); chrome.kill(); process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
