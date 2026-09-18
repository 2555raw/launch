/* A very small chain to run the contracts on: an in-process EVM, a clock we
   can move, and enough plumbing to deploy, call, read events and catch reverts.

   Deliberately not a mock of the vault — the vault under test is the real
   compiled bytecode, executing real EVM opcodes. Only the surrounding world
   (block timestamp, who is calling) is ours to set. */

import { createVM } from '@ethereumjs/vm';
import { Common, Mainnet, Hardfork } from '@ethereumjs/common';
import { createAddressFromString, createAccount, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { Interface } from 'ethers';
import { artifacts } from './compile.mjs';

/* A revert can carry a custom error declared in any contract the call touched,
   not just the one we addressed, so decode against every ABI we compiled. */
const ERRORS = new Map();
for (const a of Object.values(artifacts)) {
  for (const frag of a.abi) {
    if (frag.type !== 'error') continue;
    const sig = `${frag.name}(${frag.inputs.map(i => i.type).join(',')})`;
    if (!ERRORS.has(sig)) ERRORS.set(sig, frag);
  }
}
const ERROR_IFACE = new Interface([...ERRORS.values()]);

const GAS = 30_000_000n;

export class Chain {
  static async create() {
    const common = new Common({ chain: Mainnet, hardfork: Hardfork.Cancun });
    const vm = await createVM({ common });
    return new Chain(vm);
  }

  constructor(vm) {
    this.vm = vm;
    this.timestamp = 1_780_000_000n;   // a fixed, arbitrary "now"
    this.blockNumber = 1n;
    this.nonces = new Map();
  }

  /** Move the clock forward. */
  warp(seconds) { this.timestamp += BigInt(seconds); }

  /** A funded account at a deterministic address. */
  async account(label) {
    const addr = createAddressFromString('0x' + Buffer.from(label.padEnd(20, '_')).toString('hex').slice(0, 40));
    const acct = createAccount({ balance: 10n ** 24n });
    await this.vm.stateManager.putAccount(addr, acct);
    return addr;
  }

  get block() {
    return { header: { number: this.blockNumber, timestamp: this.timestamp,
                       gasLimit: GAS, baseFeePerGas: 0n, coinbase: createAddressFromString('0x' + '00'.repeat(20)),
                       difficulty: 0n, prevRandao: new Uint8Array(32), getBlobGasPrice: () => 0n } };
  }

  async deploy(name, args = [], from) {
    const a = artifacts[name];
    if (!a) throw new Error('no artifact: ' + name);
    const iface = new Interface(a.abi);
    const data = hexToBytes(a.bytecode + iface.encodeDeploy(args).slice(2));
    const res = await this.vm.evm.runCall({
      caller: from, origin: from, gasLimit: GAS, data, block: this.block,
    });
    const err = res.execResult.exceptionError;
    if (err) throw new Error(`deploy ${name} reverted: ${err.error} ${this.#reason(res.execResult.returnValue, iface)}`);
    const address = res.createdAddress;
    if (!address) throw new Error(`deploy ${name} produced no address`);
    return new Contract(this, address, a.abi, name);
  }

  #reason(returnValue, iface) {
    if (!returnValue || returnValue.length === 0) return '(no data)';
    const hex = bytesToHex(returnValue);
    try {
      if (hex.startsWith('0x08c379a0')) {
        const [msg] = new Interface(['function Error(string)']).decodeFunctionData('Error', hex);
        return JSON.stringify(msg);
      }
      if (hex.startsWith('0x4e487b71')) return 'Panic(' + BigInt('0x' + hex.slice(10)) + ')';
      for (const i of [iface, ERROR_IFACE]) {
        if (!i || !i.parseError) continue;
        const e = i.parseError(hex);
        if (e) return e.name + '(' + e.args.map(String).join(', ') + ')';
      }
    } catch (_) {}
    return hex.slice(0, 42);
  }

  async call({ to, from, data, iface, isStatic }) {
    const res = await this.vm.evm.runCall({
      caller: from, origin: from, to, gasLimit: GAS,
      data: hexToBytes(data), block: this.block, isStatic: !!isStatic,
    });
    const r = res.execResult;
    return {
      ok: !r.exceptionError,
      error: r.exceptionError ? r.exceptionError.error : null,
      reason: r.exceptionError ? this.#reason(r.returnValue, iface) : null,
      returnValue: bytesToHex(r.returnValue),
      logs: (r.logs || []).map(([address, topics, data]) => ({
        address: bytesToHex(address),
        topics: topics.map(bytesToHex),
        data: bytesToHex(data),
      })),
      gasUsed: r.executionGasUsed,
    };
  }
}

export class Contract {
  constructor(chain, address, abi, name) {
    this.chain = chain;
    this.address = address;
    this.iface = new Interface(abi);
    this.name = name;
  }

  get hex() { return this.address.toString(); }

  /** Read. Reverts throw. */
  async read(fn, args = [], from) {
    const caller = from || await this.chain.account('reader');
    const r = await this.chain.call({
      to: this.address, from: caller, data: this.iface.encodeFunctionData(fn, args),
      iface: this.iface, isStatic: true,
    });
    if (!r.ok) throw new Error(`${this.name}.${fn} reverted: ${r.reason}`);
    const out = this.iface.decodeFunctionResult(fn, r.returnValue);
    return out.length === 1 ? out[0] : out;
  }

  /** Write. Returns the result; never throws on revert — the caller decides. */
  async send(from, fn, args = []) {
    const r = await this.chain.call({
      to: this.address, from, data: this.iface.encodeFunctionData(fn, args), iface: this.iface,
    });
    r.events = [];
    for (const log of r.logs) {
      try {
        const p = this.iface.parseLog({ topics: log.topics, data: log.data });
        if (p) r.events.push({ name: p.name, args: p.args });
      } catch (_) {}
    }
    return r;
  }

  /** Write that must succeed. */
  async must(from, fn, args = []) {
    const r = await this.send(from, fn, args);
    if (!r.ok) throw new Error(`${this.name}.${fn} reverted: ${r.reason}`);
    return r;
  }
}
