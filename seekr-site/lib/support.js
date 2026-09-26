/* The support assistant behind "Support": an AI that knows the product.
 * Everything it knows is built here from the same config and catalog the
 * site runs on, so its answers follow the server as it is configured today.
 * When no model answers, localAnswer() picks the closest entry from the
 * FAQ below, so a question never goes unanswered. */
const config = require('./config');
const catalog = require('./catalog');
const chain = require('./chain');
const mailer = require('./mailer');

const H = config.holder;
const usd = (credits) => `$${(credits / config.creditsPerUsd).toFixed(2)}`;

/* question → answer pairs; also the offline fallback */
function faq() {
  const dep = chain.depositsConfigured();
  const depOpen = dep.eth || dep.sol || dep.btc;
  const email = config.links.email;
  const reach = email ? `${email} or https://x.com/heywondr on X` : 'https://x.com/heywondr on X';
  return [
    { k: 'account sign signin create register login log username password', q: 'How do I create an account or sign in?',
      a: `Press **Account** (top right) or **Wonder**, then pick one: **Username** and password, **Wallet** (MetaMask, Coinbase Wallet, Phantom or any browser wallet signs a message, no transaction, no gas)${mailer.configured() ? ', or **Email code** (we send a 6-digit code)' : ''}. There is no sign-up form. You can also keep an **access key** (starts with \`seek_\`) and paste it under "I have an access key".` },
    { k: 'lost key forgot password recover locked out cannot get in access', q: 'I lost my key or forgot my password.',
      a: `If you signed up with a wallet, just sign in with the same wallet again. If you added an email to your account, use **Email code** to get back in${mailer.configured() ? '' : ' (email sign-in is being switched on)'}. With a username, a password can be changed from the account page while you are signed in. If none of that works, message ${reach} with your username or the wallet you signed up with (never a password or access key).` },
    { k: 'pay deposit fund funds top add money balance usdt btc eth sol crypto card', q: 'How do I add funds?',
      a: depOpen
        ? `Open **Account → Top up**, send ${[dep.eth && 'ETH or USDT (Ethereum)', dep.sol && 'SOL', dep.btc && 'BTC'].filter(Boolean).join(', ')} to the address shown, then paste the transaction id. The server checks it on chain and credits you at the live rate: $1 = ${config.creditsPerUsd.toLocaleString()} credits, no fee on the deposit. Card payments are not offered.`
        : `Deposits are crypto only: USDT, ETH, SOL or BTC at the live rate, $1 = ${config.creditsPerUsd.toLocaleString()} credits, no fee on the deposit. Deposit addresses are being switched on right now, so the Top up box in your account may not show an address yet. Card payments are not offered.` },
    { k: 'deposit not arrived arrive missing pending transaction txid hash confirm', q: 'My deposit has not shown up.',
      a: `Credits are added when you paste the transaction id in **Account → Top up** and it has at least ${config.chain.minConfirmations} confirmation(s). Make sure you sent to the exact address shown, on the right network (USDT must be ERC-20 on Ethereum). A transaction id can only be credited once. If it still fails, send the transaction id to ${reach}.` },
    { k: 'price prices cost much credits expensive per token pricing calculator', q: 'How much does it cost?',
      a: `You pay per request, no subscription. Each model has a price on the **Pricing** page: per token for text, per image, per second of video, per character for speech. That price is the provider's own price plus a fixed ${((config.markup - 1) * 100).toFixed(1)}% margin, in credits at $1 = ${config.creditsPerUsd.toLocaleString()} credits. The **Calculator** turns a workload into credits. Credits never expire.` },
    { k: 'subscription monthly recurring cancel', q: 'Is there a subscription?', a: 'No. Nothing is recurring. You fund one balance and it goes down as you use models. Credits never expire.' },
    { k: 'models available which claude gpt gemini deepseek grok flux video image voice', q: 'Which models can I use?',
      a: `Chat and code: ${names('chat')}. Images: ${names('image')}. Video: ${names('video')}. Voice: ${names('tts')}. Pick the model in the box under the prompt on the **Ask** page.` },
    { k: 'wondr token holder holders discount allowance 5% hold holding give benefits', q: 'What does holding $WONDR give me?',
      a: `Holders pay **${H.pricePct * 100}% of the list price** inside a daily allowance of ${H.creditsPerStep.toLocaleString()} credits per ${H.stepPct}% of supply held, up to ${H.maxAllowance.toLocaleString()} credits a day (${usd(H.maxAllowance)} at list), reset 00:00 UTC. From ${H.earlyAccessPct}% you get new models 14 days early, from ${H.priorityPct}% priority routing. Link your wallet in **Account** so the server can read your balance (it only signs a message).` },
    { k: 'buy token where contract address chart robinhood chain launch', q: 'Where do I buy $WONDR?',
      a: config.chain.seekrToken
        ? `$WONDR lives on Robinhood Chain (chain id 4663). Contract: \`${config.chain.seekrToken}\`. Use **Buy $WONDR** on the Token page.`
        : '$WONDR launches on Robinhood Chain (an Arbitrum L2, chain id 4663), paired against ETH, with a fixed supply of 1,000,000,000. It is not live yet, so there is no contract address to buy. Watch https://x.com/heywondr for the launch and never trust an address sent to you in a DM.' },
    { k: 'swap exchange trade convert token coin gold stock real world asset rwa metamask phantom coinbase', q: 'How does Swap work?',
      a: 'Open **Swap** in the top menu, connect MetaMask, Coinbase Wallet or Phantom, pick what you pay and what you get, and press Swap. Routes are found by LI.FI across DEXs and bridges, on one chain or across chains (EVM and Solana). You sign in your own wallet; wondr never holds your funds. The **Real-world assets** shelf has tokenized gold (PAXG, XAUT), US treasuries and tokenized stocks (xStocks).' },
    { k: 'swap failed error stuck slippage approve gas pending bridge', q: 'My swap failed or is stuck.',
      a: 'Check that you have enough of the native coin for gas (ETH, SOL, etc.) on the chain you pay from. If the price moved, get a fresh quote and try again. Some tokens need an **Approve** transaction first, then the swap. Cross-chain swaps can take a few minutes: the status updates on the page, and the transaction link opens in the explorer. If funds left your wallet and did not arrive after 30 minutes, send the transaction hash to ' + reach + '.' },
    { k: 'xstocks us united states restricted country stocks legal', q: 'Can anyone buy tokenized stocks?',
      a: 'Tokenized stocks (xStocks) are not available to US persons and some other countries, under the issuer\'s own terms. Check the issuer\'s rules for where you live before buying.' },
    { k: 'demo free tier answer not real model which model answered', q: 'Why does it say free or demo?',
      a: 'When a model\'s provider is not connected on the server, the request is answered by a free open model instead (marked **free**) or, if that is down, a labelled demo. Free and demo answers cost 0 credits. The label under each answer says who answered.' },
    { k: 'privacy data safe delete chats library email', q: 'Is my data private?',
      a: 'Prompts go only to the model provider that answers them. Your chats, files and library stay on your account until you delete them. Email is optional and only used for sign-in and recovery.' },
    { k: 'api developer key programmatic curl endpoint', q: 'Is there an API?',
      a: 'Yes, the same API the app uses. See the **Developers** page: create a key with `POST /api/auth/key`, then stream chat from `POST /api/chat` with `Authorization: Bearer seek_…`. Images, video, speech and transcription have their own endpoints, and every response says what it cost.' },
    { k: 'expire credits refund', q: 'Do credits expire? Can I get a refund?',
      a: `Credits never expire. Deposits are on-chain transfers, so they cannot be reversed automatically; for a problem with a charge, message ${reach} with your account and the request.` },
    { k: 'contact human email team talk person twitter x', q: 'How do I reach a person?',
      a: `Message ${reach}.` }
  ];
}

function names(kind) {
  return catalog.MODELS.filter((m) => m.kind === kind).map((m) => m.name).join(', ');
}

function priceTable() {
  const c = (per) => (per * config.markup * config.creditsPerUsd).toFixed(per < 0.01 ? 3 : 1);
  return catalog.MODELS.map((m) => {
    const p = m.price || {};
    let s = '';
    if (m.kind === 'chat') s = `$${(p.in * config.markup).toFixed(2)} in / $${(p.out * config.markup).toFixed(2)} out per 1M tokens`;
    else if (p.image != null) s = `${c(p.image)} credits per image`;
    else if (p.second != null) s = `${c(p.second)} credits per second`;
    else if (p.mchars != null) s = `${c(p.mchars / 1000)} credits per 1,000 characters`;
    else if (p.minute != null) s = `${c(p.minute)} credits per minute`;
    return `- ${m.name} (${m.vendor}, ${m.kind}${m.context ? `, ${Math.round(m.context / 1000)}k context` : ''})${s ? ': ' + s : ''}${require('./router').isLive(m) ? '' : ['video', 'stt'].includes(m.kind) ? ' [not switched on yet on this server]' : ' [answered by a free model on this server today]'}`;
  }).join('\n');
}

function system(account) {
  const f = faq().map((x) => `Q: ${x.q}\nA: ${x.a}`).join('\n\n');
  let me = 'The visitor is not signed in.';
  if (account) {
    const credits = require('./credits');
    const al = credits.allowance(account);
    me = `The visitor is signed in. Account id ${account.id}${account.username ? `, username ${account.username}` : ''}${account.wallet ? `, wallet ${account.wallet}` : ''}${account.email ? `, email on file` : ', no email on file'}. Balance: ${Math.round(account.balance || 0).toLocaleString()} credits (${usd(account.balance || 0)}). $WONDR held: ${al.pct}% of supply; holder allowance today ${al.left.toLocaleString()} of ${al.total.toLocaleString()} credits left.`;
  }
  return `You are the support assistant for wondr (${config.publicUrl || 'wondr.website'}), inside the Support panel on the site.

Your job: solve the visitor's problem completely, right here. Be warm, direct and short (2 to 6 sentences, or a short numbered list for steps). Always answer in the language the visitor writes in. Give exact steps with the names of buttons and pages as they appear on the site (in bold). Use only the facts below; if something is not covered, say so plainly and give the best next step, never invent prices, addresses, dates or features. Never ask for a seed phrase, private key, password or access key, and warn the visitor if they paste one. wondr staff never DM first. For anything you truly cannot fix (a lost deposit, a bug, a business request), tell them to message ${config.links.email ? config.links.email + ' or ' : ''}https://x.com/heywondr on X with the details you list.

WHAT WONDR IS
One platform for every major AI model (chat, code, images, video, voice), paid with crypto from one balance: no subscription, pay per request. Plus Swap: any coin to any coin or to tokenized real-world assets, from the visitor's own wallet. Token: $WONDR on Robinhood Chain.

PAGES
Home (/), Swap (/swap), How it works (/#how), Models and Pricing (/pricing), Compare models side by side (/compare), wondr vs subscriptions (/alternatives), Calculator (/calculator), Token (/token), Community (/community), Developers (/developers), the app (/ask: Ask, Code, Images, Video modes, chat history, Library, Account). The theme button (sun/moon) switches day and night mode.

FACTS
- Credits: $1 = ${config.creditsPerUsd.toLocaleString()} credits. List price = provider price × ${config.markup} (a ${((config.markup - 1) * 100).toFixed(1)}% margin). Credits never expire.${config.welcomeCredits ? ` New accounts get ${config.welcomeCredits.toLocaleString()} welcome credits.` : ''}
- Sign-in: username + password, wallet signature, ${mailer.configured() ? 'email code, ' : ''}or an access key (seek_…). Email is optional.
- Payments: crypto only (USDT, ETH, SOL, BTC). No card payments.
- $WONDR: supply 1,000,000,000 fixed, no mint, no presale, no team allocation, launched on the Pons curve paired with ETH; the company buys its 5% on the curve like anyone and locks it; liquidity locked with Team Finance when the curve graduates. Robinhood Chain docs: https://docs.robinhood.com/chain/. ${config.chain.seekrToken ? `Contract: ${config.chain.seekrToken}.` : 'Not launched yet: there is no contract address; anyone giving one before the official launch post on https://x.com/heywondr is a scammer.'}
- Contact: ${config.links.email ? config.links.email + ', ' : ''}X https://x.com/heywondr.

MODELS AND LIST PRICES
${priceTable()}

FAQ
${f}

THE VISITOR
${me}`;
}

/* offline fallback: best keyword match from the FAQ */
function localAnswer(text) {
  const words = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9$%]+/g) || [];
  const alias = { pagar: 'pay', pago: 'pay', deposito: 'deposit', depositar: 'deposit', saldo: 'balance', cuenta: 'account', entrar: 'login', contrasena: 'password', clave: 'key', precio: 'price', cuesta: 'cost', modelos: 'models', comprar: 'buy', token: 'token', intercambio: 'swap', oro: 'gold', acciones: 'stock', tarjeta: 'card', privacidad: 'privacy', reembolso: 'refund', contacto: 'contact', ayuda: 'contact', error: 'error', fallo: 'failed', atascado: 'stuck', llega: 'arrived', llegado: 'arrived', no: 'not', fondos: 'funds', dinero: 'money' };
  const stop = new Set(['how', 'do', 'does', 'i', 'the', 'a', 'an', 'my', 'is', 'what', 'can', 'to', 'in', 'up', 'on', 'it', 'me', 'of', 'and', 'or', 'where', 'why', 'which', 'there', 'for', 'como', 'que', 'el', 'la', 'mi', 'de', 'y', 'en', 'un', 'una', 'es', 'por']);
  const set = new Set(words.map((w) => w.replace(/^\$/, '')).map((w) => alias[w] || w).filter((w) => !stop.has(w)));
  let best = null; let score = 0;
  for (const e of faq()) {
    const s = e.k.split(' ').reduce((n, k) => n + (set.has(k) ? 1 : 0), 0);
    if (s > score) { best = e; score = s; }
  }
  return best ? best.a : `I can help with accounts and sign-in, adding funds, prices and models, Swap, and the $WONDR token. Tell me a bit more about what you need, or message https://x.com/heywondr on X.`;
}

module.exports = { system, localAnswer, faq };
