import fs from 'node:fs';
import path from 'node:path';

// Simulated account. Nothing here touches real money: a "trade" is a row in
// state.json, settled later against the real market result.
export class PaperAccount {
  constructor(file, startBankroll) {
    this.file = file;
    this.state = { startBankroll, cash: startBankroll, open: [], closed: [], startedAt: Date.now() };
    try {
      this.state = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      // first run, or unreadable: start fresh
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.state, null, 2));
    fs.renameSync(this.file + '.tmp', this.file);
  }

  holds(marketId) {
    return this.state.open.some((p) => p.marketId === marketId);
  }

  buy({ market, side, plan, prob, btc }) {
    const total = plan.cost + plan.fees;
    if (total > this.state.cash) return null;
    this.state.cash -= total;
    const pos = {
      id: `${market.id}-${Date.now()}`,
      marketId: market.id,
      slug: market.slug,
      eventSlug: market.eventSlug,
      question: market.question,
      kind: market.kind,
      label: market.label,
      start: market.start,
      end: market.end,
      strike: market.K,
      L: market.L,
      side,
      outcome: market.outcomes[side],
      shares: plan.shares,
      avgPrice: plan.avgPrice,
      cost: plan.cost,
      fees: plan.fees,
      prob,
      expectedProfit: plan.expectedProfit,
      btcAtEntry: btc,
      openedAt: Date.now(),
    };
    this.state.open.push(pos);
    this.save();
    return pos;
  }

  settle(pos, winner, method) {
    const payout = pos.side === winner ? pos.shares : 0;
    this.state.cash += payout;
    this.state.open = this.state.open.filter((p) => p !== pos);
    this.state.closed.unshift({ ...pos, winner, payout, pnl: payout - pos.cost - pos.fees, method, closedAt: Date.now() });
    this.state.closed = this.state.closed.slice(0, 500);
    this.save();
  }

  summary() {
    const { startBankroll, cash, open, closed } = this.state;
    const atRisk = open.reduce((a, p) => a + p.cost + p.fees, 0);
    const realized = closed.reduce((a, p) => a + p.pnl, 0);
    const wins = closed.filter((p) => p.pnl > 0).length;
    const expected = closed.reduce((a, p) => a + p.expectedProfit, 0);
    return {
      startBankroll, cash, atRisk,
      equity: cash + atRisk,
      realized,
      expectedOnClosed: expected,
      trades: closed.length,
      wins,
      losses: closed.length - wins,
      fees: closed.reduce((a, p) => a + p.fees, 0),
    };
  }
}
