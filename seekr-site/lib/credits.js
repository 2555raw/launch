/* Prices, credits and the $SEEKR holder allowance.
 *
 *   list price   = provider price × markup
 *   credits      = usd × 1000
 *   holder price = 5% of list, inside a daily allowance of
 *                  1,000 credits per 0.01% of supply held (max 25,000),
 *                  reset at 00:00 UTC. Past the allowance: list price. */
const config = require('./config');
const catalog = require('./catalog');

const H = config.holder;

const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/* provider USD for a piece of usage, before markup */
function providerUsd(model, usage = {}) {
  const p = model.price;
  switch (model.kind) {
    case 'chat':
      return ((usage.inTokens || 0) * p.in + (usage.outTokens || 0) * p.out) / 1e6;
    case 'image':
      return (usage.images || 1) * p.image;
    case 'video':
      return (usage.seconds || 5) * p.second;
    case 'tts':
      return ((usage.chars || 0) / 1e6) * p.mchars;
    case 'stt':
      return (usage.minutes || 0) * p.minute;
    default:
      return 0;
  }
}

const listUsd = (model, usage) => providerUsd(model, usage) * config.markup;
const listCredits = (model, usage) => listUsd(model, usage) * config.creditsPerUsd;

/* what the site shows per model: list price and holder price for one unit */
function unitPrices(model) {
  const unit = { chat: '/1M out', image: '/image', video: '/second', tts: '/1M chars', stt: '/minute' }[model.kind];
  const usage = { chat: { outTokens: 1e6 }, image: { images: 1 }, video: { seconds: 1 }, tts: { chars: 1e6 }, stt: { minutes: 1 } }[model.kind];
  const usd = listUsd(model, usage);
  return { unit, usd: round(usd, 4), holderUsd: round(usd * H.pricePct, 4), inUsd: model.price.in ? round(model.price.in * config.markup, 4) : null };
}

function todayUtc() { return new Date().toISOString().slice(0, 10); }

/* the holder allowance for an account: credits/day it can spend at 5% */
function allowance(account) {
  const pct = account.holdingsPct || 0;
  const steps = Math.floor(pct / H.stepPct + 1e-9);
  const total = Math.min(H.maxAllowance, steps * H.creditsPerStep);
  const a = account.allowance && account.allowance.day === todayUtc() ? account.allowance : { day: todayUtc(), used: 0 };
  return { total, used: round(a.used), left: Math.max(0, round(total - a.used)), pct, resetsAt: todayUtc() + 'T00:00:00Z' };
}

function tier(account) {
  const pct = account.holdingsPct || 0;
  return {
    pct,
    holder: pct > 0,
    discount: allowance(account).total > 0,
    priority: pct >= H.priorityPct,
    earlyAccess: pct >= H.earlyAccessPct
  };
}

/* Split a list-price charge between the allowance (at 5%) and full price. */
function quote(model, usage, account) {
  const list = listCredits(model, usage);
  const a = account ? allowance(account) : { left: 0, total: 0 };
  const inAllowance = Math.min(list, a.left);
  const discounted = inAllowance * H.pricePct;
  const full = list - inAllowance;
  const credits = round(discounted + full);
  return { model: model.id, listCredits: round(list), credits, usd: round(credits / config.creditsPerUsd, 6), fromAllowance: round(inAllowance), saved: round(list - credits) };
}

/* rough estimate for the "~7.4 cr" hint under the composer */
function estimateChat(model, text, expectedOut = 600) {
  const inTokens = Math.ceil((text || '').length / 4) + 40;
  return { inTokens, outTokens: expectedOut };
}

function canAfford(account, credits) {
  return (account.balance || 0) + 1e-9 >= credits;
}

/* Charge the account. Returns the usage record; throws with .code='insufficient'. */
function debit(store, account, model, usage, meta = {}) {
  const q = quote(model, usage, account);
  if (!canAfford(account, q.credits)) {
    const err = new Error('Insufficient credits');
    err.code = 'insufficient';
    err.needed = q.credits;
    throw err;
  }
  const a = allowance(account);
  account.allowance = { day: a.day || todayUtc(), used: round(a.used + q.fromAllowance) };
  account.balance = round(account.balance - q.credits);
  account.spent = round((account.spent || 0) + q.credits);
  const rec = {
    id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    account: account.id,
    at: new Date().toISOString(),
    model: model.id,
    kind: model.kind,
    usage,
    credits: q.credits,
    listCredits: q.listCredits,
    saved: q.saved,
    ...meta
  };
  store.put('usage', rec.id, rec);
  store.put('accounts', account.id, account);
  return rec;
}

function credit(store, account, credits, meta = {}) {
  account.balance = round((account.balance || 0) + credits);
  account.deposited = round((account.deposited || 0) + credits);
  const rec = { id: 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), account: account.id, at: new Date().toISOString(), credits: round(credits), ...meta };
  store.put('deposits', rec.id, rec);
  store.put('accounts', account.id, account);
  return rec;
}

module.exports = { providerUsd, listUsd, listCredits, unitPrices, allowance, tier, quote, estimateChat, canAfford, debit, credit, round, catalog };
