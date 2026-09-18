/* End-to-end down the Pons route, against a Pons that is not the real one.
 *
 * Pons lives on Robinhood Chain and no test machine here can reach it, so the
 * one call that spends money was the one call never exercised: every launch
 * through Pons was, until this ran, a piece of code whose first execution was
 * in front of a real wallet on mainnet. That is how a TokenParams one field
 * short shipped — the selector no function answers to, and every launch
 * reverting with nothing to read.
 *
 * PonsV2Mock.sol puts the published surface on the local node. This aims a
 * browser at it, connects a wallet and walks launch → read back → buy → sell,
 * asserting at each step that the pairing survived the one field Pons gives us
 * to carry it in.
 *
 * Two things it deliberately does NOT prove: that the real factory behaves
 * this way — contracts/pons-test.js pins the selectors against the signatures
 * written out of the Solidity for that — and anything about graduation, which
 * the mock does not implement.
 *
 * Needs, as the other suite does, `npm run node` and a server on :8080.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { ethers } = require('ethers');
const { WALLET_SHIM } = require('./wallet-shim');

const CHAIN = Number(process.env.CHAIN_ID || 46630);
const RPC = 'http://127.0.0.1:8545';
const base = 'http://127.0.0.1:8080/';
const LAUNCH_FEE = ethers.parseEther('0.0005');

const log = [];
const step = async (name, fn) => { process.stdout.write(name + ' … '); await fn(); console.log('ok'); };

function compile() {
  const file = path.join(__dirname, 'PonsV2Mock.sol');
  const out = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity',
    sources: { 'PonsV2Mock.sol': { content: fs.readFileSync(file, 'utf8') } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  })));
  for (const e of out.errors || []) {
    if (e.severity === 'error') throw new Error(e.formattedMessage);
  }
  const c = out.contracts['PonsV2Mock.sol'].PonsV2LaunchFactory;
  return { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
}

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: true });
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN) {
    throw new Error(`the node answers as chain ${net.chainId}, not ${CHAIN}`);
  }
  const accounts = await provider.listAccounts();
  const deployer = await provider.getSigner(await accounts[1].getAddress());
  const visitor = await accounts[0].getAddress();

  /* The public gate is SHUT and the visitor is whitelisted. That is the case
   * the page got wrong once by reading launchEnabled() instead of
   * canLaunch(caller): the two differ here and nowhere else. */
  const { abi, bytecode } = compile();
  const factory = await new ethers.ContractFactory(abi, bytecode, deployer).deploy(LAUNCH_FEE, false);
  await factory.waitForDeployment();
  const at = await factory.getAddress();
  await (await factory.setWhitelisted(visitor, true)).wait();
  console.log(`\nmock Pons at ${at}  ·  gate shut, ${visitor.slice(0, 8)}… whitelisted\n`);

  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1360, height: 950 } });
  p.on('pageerror', e => log.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/CERT|favicon|fonts/.test(m.text())) log.push('CONSOLE ' + m.text()); });
  await p.addInitScript(WALLET_SHIM('0x' + CHAIN.toString(16)));
  /* Aim this browser at the mock, the way a test is allowed to and a visitor
   * on Robinhood Chain is not. */
  await p.addInitScript(([c, a]) => {
    try {
      localStorage.setItem(`hydropad.pons.factory.${c}`, a);
      /* The watcher ticks every twenty seconds in a browser. Nothing here can
       * wait that long per assertion. */
      localStorage.setItem('hydropad.watch.ms', '1500');
    } catch (e) {}
  }, [CHAIN, at]);

  const umd = path.join(__dirname, '..', 'node_modules', 'ethers', 'dist', 'ethers.umd.min.js');
  await p.route('https://cdnjs.cloudflare.com/**', route =>
    fs.existsSync(umd)
      ? route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(umd, 'utf8') })
      : route.continue());
  await p.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));

  await step('the page routes this chain through Pons', async () => {
    await p.goto(base + 'launch.html', { waitUntil: 'networkidle' });
    const via = await p.evaluate(() => Chain.viaPons());
    if (!via) throw new Error('the page is not routing through Pons');
  });

  await step('a shut public gate does not lock out a whitelisted address', async () => {
    /* Connected here rather than on another page and navigated back: the
     * injected wallet is re-created on every load, as a real one is not. */
    await p.click('#w-connect');
    await p.waitForFunction(() => !!Chain.account, null, { timeout: 15000 });
    await p.waitForFunction(() => /Launching through Pons V2/.test(document.body.textContent),
      null, { timeout: 20000 });
    const route = await p.evaluate(() => Chain.launchRoute());
    if (route !== 'pons') throw new Error('the launch would go via ' + route);
    /* The distinction this whole step exists for, read off the chain itself. */
    const gate = await p.evaluate(() => PONS.factory(Chain.provider, Chain.chainId).launchEnabled());
    if (gate) throw new Error('the gate was supposed to be shut');
  });

  await step('the form quotes the fee the factory actually charges', async () => {
    await p.waitForFunction(() => /Launch fee 0\.0005 ETH/.test(document.querySelector('#f-cost')?.textContent || ''),
      null, { timeout: 20000 });
  });

  await step('supply is Pons\' to set, and the form says so', async () => {
    /* The box used to take a number that was then thrown away: on this route
     * the launch config mints a fixed amount and the form is not consulted. */
    await p.waitForFunction(() => {
      const el = document.querySelector('#f-supply');
      return el && el.readOnly && Number(el.value) === 800000000;
    }, null, { timeout: 20000 });
    const note = (await p.textContent('#f-supply-note')).trim();
    if (!/Pons/.test(note)) throw new Error('the field does not say whose it is: ' + note);
  });

  await step('the preview card quotes Pons\' terms, not our own launcher\'s', async () => {
    /* All four numbers were the own launcher's, hardcoded: a launch fee of
     * None beside a form quoting Pons' real one, and a trade fee going to a
     * vault Pons does not have. */
    const boxes = await p.locator('.pv-boxes > div').evaluateAll(
      els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    const card = boxes.join(' | ');
    if (/None/.test(card)) throw new Error('still quoting a free launch: ' + card);
    if (/to your vault/.test(card)) throw new Error('still quoting our own vault: ' + card);
    if (!/Launch fee ?0\.0005/.test(card)) throw new Error('wrong fee: ' + card);
    if (!/1\.00% on the curve/.test(card)) throw new Error('wrong trade fee: ' + card);
    if (!/30(\.0)? ETH raised/.test(card)) throw new Error('wrong graduation: ' + card);
    /* And a price off a fresh curve is readable rather than an exponent. */
    const price = boxes.find(b => /Opening price/.test(b)) || '';
    if (/e-\d/.test(price)) throw new Error('the price is in exponent notation: ' + price);
    if (!/gwei|ETH/.test(price)) throw new Error('the price carries no unit: ' + price);
    console.log('  ', card);
  });

  await step('the launch goes through Pons and pays the fee exactly', async () => {
    const before = await provider.getBalance(at);
    await p.fill('#f-name', 'Dead Pool');
    await p.fill('#f-symbol', 'pool');
    await p.selectOption('#f-source', 'MEAD');
    await p.fill('#f-firstbuy', '0.5');
    await p.click('button[type=submit]');
    await p.waitForURL(/token\.html\?addr=0x/, { timeout: 60000 });
    const after = await provider.getBalance(at);
    if (after - before !== LAUNCH_FEE) {
      throw new Error(`the factory took ${ethers.formatEther(after - before)} ETH, not the launch fee`);
    }
  });

  const token = new URL(p.url()).searchParams.get('addr');
  console.log('   token:', token);

  await step('Pons knows the token, and it is the one the page navigated to', async () => {
    const rec = await factory.getLaunchedToken(token);
    if (!rec.exists) throw new Error('the factory has no record of ' + token);
    if (rec.deployer.toLowerCase() !== visitor.toLowerCase()) throw new Error('wrong deployer');
    if (rec.pairToken !== ethers.ZeroAddress) throw new Error('the curve is not ETH-quoted');
    console.log('   curve:', rec.curve);
  });

  await step('the pairing is on chain, readable by anyone, and reads back', async () => {
    const erc = new ethers.Contract(token,
      ['function description() view returns (string)', 'function symbol() view returns (string)'], provider);
    const description = await erc.description();
    if (!/Lake Mead/.test(description)) throw new Error('the place is not in it: ' + description);
    if (!/\[hydropad:1:MEAD\]/.test(description)) throw new Error('no tag: ' + description);
    if (!/no ownership of the water/.test(description)) throw new Error('the disclaimer did not travel');
    if ((await erc.symbol()) !== 'POOL') throw new Error('wrong symbol');
    /* And the page reads the same ticker back out of it without being told. */
    const read = await p.evaluate(t => Chain.tokenMeta(t).then(m => m.source), token);
    if (read !== 'MEAD') throw new Error('the page read the source as ' + read);
    console.log('   description:', description.slice(0, 64) + '…');
  });

  /* The UI drives, the chain judges. Reading the balance back through the page
   * would let a page that renders a stale number pass its own test. */
  const erc20 = new ethers.Contract(token,
    ['function balanceOf(address) view returns (uint256)'], provider);
  const settles = async (read, what) => {
    const before = await read();
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 500));
      const now = await read();
      if (now !== before) return now - before;
    }
    throw new Error(what + ' never landed on chain');
  };

  await step('the opening buy landed on the curve', async () => {
    await p.waitForSelector('#buy-btn', { timeout: 30000 });
    const held = await erc20.balanceOf(visitor);
    if (held <= 0n) throw new Error('the first buy bought nothing');
    console.log('   holding:', ethers.formatEther(held), 'POOL');
  });

  await step('the same ETH buys fewer tokens the second time', async () => {
    const first = await erc20.balanceOf(visitor);   // 0.5 ETH bought this
    await p.fill('#buy-amount', '0.5');
    await p.click('#buy-btn');
    const second = await settles(() => erc20.balanceOf(visitor), 'the second buy');
    if (second <= 0n) throw new Error('the second buy bought nothing');
    if (second >= first) {
      throw new Error(`the curve is flat: 0.5 ETH bought ${second} after buying ${first}`);
    }
    console.log('   0.5 ETH bought', ethers.formatEther(first), 'then', ethers.formatEther(second));
  });

  await step('selling back into the curve returns ETH', async () => {
    const held = await erc20.balanceOf(visitor);
    const eth = await provider.getBalance(visitor);
    await p.fill('#sell-amount', ethers.formatEther(held / 4n));
    await p.click('#sell-btn');
    const sold = await settles(() => erc20.balanceOf(visitor), 'the sell');
    if (sold >= 0n) throw new Error('the sell did not reduce the holding');
    const back = await provider.getBalance(visitor);
    if (back <= eth) throw new Error('selling returned no ETH');
    console.log('   sold', ethers.formatEther(-sold), 'POOL for',
      ethers.formatEther(back - eth), 'ETH net of gas');
  });

  await step('the launches table lists it, read off Pons', async () => {
    await p.goto(base + 'launches.html', { waitUntil: 'networkidle' });
    await p.waitForFunction(t => document.querySelector('#launch-rows')?.textContent.includes('POOL'),
      token, { timeout: 45000 });
  });

  await step('somebody else launching shows up without a reload', async () => {
    /* Launched straight from another account, the way a stranger would: the
     * page is not told, it has to notice. */
    const stranger = await provider.getSigner(await accounts[2].getAddress());
    const asStranger = factory.connect(stranger);
    const economics = await factory.previewLaunchEconomics(0, ethers.ZeroAddress);
    await (await factory.setWhitelisted(await stranger.getAddress(), true)).wait();

    const before = await p.locator('#launch-rows tr').count();
    await (await asStranger.launchToken({
      name: 'Glacier Pool',
      symbol: 'GLACE',
      logo: '',
      description: 'Paired to Vatnajökull, Iceland (ICE). [hydropad:1:ICE]',
      socials: { twitter: '', telegram: '', discord: '', website: '', farcaster: '' },
      creatorFeeRecipient: await stranger.getAddress(),
      creatorTaxBps: 0,
      buybackEnabled: true,
      expectedEconomics: economics,
      salt: ethers.hexlify(ethers.randomBytes(32)),
    }, 0, ethers.ZeroAddress, { value: LAUNCH_FEE })).wait();

    await p.waitForFunction(
      n => document.querySelectorAll('#launch-rows tr').length > n
        && document.querySelector('#launch-rows').textContent.includes('GLACE'),
      before, { timeout: 60000 });
    console.log('   the table grew from', before, 'rows on its own');
  });

  await step('the header carries the address', async () => {
    const shown = (await p.textContent('#last-ca')).replace(/\s+/g, ' ').trim();
    if (!shown.includes(token.slice(0, 6))) throw new Error('the slot reads ' + shown);
  });

  await p.screenshot({ path: 'e2e-pons.png', fullPage: false });
  console.log('\nerrors:', log.length ? log : 'none');
  await b.close();
  process.exit(log.length ? 1 : 0);
})().catch(async e => {
  console.error('\nFAILED:', e.message);
  console.log('errors:', log);
  process.exit(1);
});
