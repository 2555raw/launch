import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NATIVE_TOKEN_ADDRESS,
  fmtEth,
  isNativeToken,
  nativeTransferProblem,
  usdToWei,
  weiToEth,
  type NativePayoutExpectation,
} from "../src/lib/web3/native.ts";

test("the native sentinel is recognised in any case, contracts are not", () => {
  assert.equal(isNativeToken(NATIVE_TOKEN_ADDRESS), true);
  assert.equal(isNativeToken("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"), true);
  assert.equal(isNativeToken("0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"), true);
  assert.equal(isNativeToken("0x5fc5360d0400a0fd4f2af552add042d716f1d168"), false);
  assert.equal(isNativeToken(undefined), false);
  assert.equal(isNativeToken(""), false);
});

test("dollars convert to wei at the quoted price", () => {
  // $3,000 at $3,000/ETH is exactly one ETH.
  assert.equal(usdToWei("3000", "3000"), 10n ** 18n);
  assert.equal(usdToWei("3000.000000", "3000.00"), 10n ** 18n);
  // $4.61 at $3,736.12/ETH
  assert.equal(usdToWei("4.61", "3736.12"), 1_233_900_410_051_069n);
});

test("conversion rounds down to the wei, never up", () => {
  // $1 at $3/ETH = 0.333… ETH: the last wei is dropped, not rounded up.
  assert.equal(usdToWei("1", "3"), 333_333_333_333_333_333n);
  // $2 at $3/ETH = 0.666… ETH: rounding to nearest would give …667.
  assert.equal(usdToWei("2", "3"), 666_666_666_666_666_666n);
  // wei = floor($4.613457 / $3,736.12 × 1e18) = floor(4613457 × 1e14 / 373612): never worth more than owed,
  // and one more wei would be.
  const wei = usdToWei("4.613457", "3736.12");
  const owed = 4_613_457n * 10n ** 14n;
  assert.ok(wei * 373_612n <= owed);
  assert.ok((wei + 1n) * 373_612n > owed);
});

test("conversion rejects bad input", () => {
  assert.throws(() => usdToWei("1", "0"));
  assert.throws(() => usdToWei("abc", "3000"));
  assert.throws(() => usdToWei("-1", "3000"));
  assert.equal(usdToWei("0", "3000"), 0n);
});

test("wei prints as an exact ETH amount that parses back to the same wei", () => {
  assert.equal(weiToEth(10n ** 18n), "1");
  assert.equal(weiToEth(1n), "0.000000000000000001");
  assert.equal(weiToEth(1_233_900_410_051_069n), "0.001233900410051069");
  assert.equal(weiToEth(1_500_000_000_000_000_000n), "1.5");
  assert.equal(weiToEth(0n), "0");
  // Round trip through the 18 decimal string the database stores.
  assert.equal(usdToWei(weiToEth(1_233_900_410_051_069n), "1"), 1_233_900_410_051_069n);
});

test("ETH amounts read well", () => {
  assert.equal(fmtEth("0.001233900410051069"), "0.001234");
  assert.equal(fmtEth("1.23456"), "1.2346");
  assert.equal(fmtEth(0), "0");
});

const payoutWallet = "0x1111111111111111111111111111111111111111";
const walker = "0x2222222222222222222222222222222222222222";
const expected: NativePayoutExpectation = {
  walletAddress: walker,
  amountUnits: "1233900410051069",
  fromAddress: payoutWallet,
  chainId: 4663,
  payoutWallets: [payoutWallet],
};
const good = { from: payoutWallet.toUpperCase().replace("0X", "0x"), to: walker.toUpperCase().replace("0X", "0x"), value: 1_233_900_410_051_069n, chainId: 4663 };

test("a native transfer matching the payout passes (addresses compared case insensitively)", () => {
  assert.equal(nativeTransferProblem(good, expected), null);
  // Legacy transactions may not carry a chain id: the receipt was read from the payout chain anyway.
  assert.equal(nativeTransferProblem({ ...good, chainId: undefined }, expected), null);
});

test("a native transfer that differs from the payout in any way is refused", () => {
  assert.equal(nativeTransferProblem({ ...good, value: 1_233_900_410_051_068n }, expected), "amount");
  assert.equal(nativeTransferProblem({ ...good, value: 1_233_900_410_051_070n }, expected), "amount");
  assert.equal(nativeTransferProblem({ ...good, to: "0x3333333333333333333333333333333333333333" }, expected), "recipient");
  assert.equal(nativeTransferProblem({ ...good, to: null }, expected), "recipient");
  assert.equal(nativeTransferProblem({ ...good, chainId: 1 }, expected), "network");
  assert.equal(
    nativeTransferProblem({ ...good, from: "0x4444444444444444444444444444444444444444" }, expected),
    "sender differs from the recorded wallet",
  );
  // Recorded sender that is not (or no longer) an authorised payout wallet.
  assert.equal(nativeTransferProblem(good, { ...expected, payoutWallets: [] }), "sender is not an authorised payout wallet");
  assert.equal(nativeTransferProblem(good, { ...expected, fromAddress: null }), "sender differs from the recorded wallet");
});
