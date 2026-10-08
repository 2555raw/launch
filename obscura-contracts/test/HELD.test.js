const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const E = (n) => ethers.parseUnits(String(n), 18);
const SUPPLY = E(1_000_000_000);

async function deployFixture() {
  const [owner, pair, buyer, alice, bob, prover, other] = await ethers.getSigners();
  const HELD = await ethers.getContractFactory("HELD");
  // Proposal: 0.30% fee, 80% of it burned, 20% to the prover pool.
  const held = await HELD.deploy("HeldAt", "HELD", SUPPLY, 30, 8000, prover.address);
  await held.setPair(pair.address, true);
  // Stand-in for the AMM pair: an account flagged as a pair, seeded with liquidity.
  await held.transfer(pair.address, E(10_000_000));
  return { held, owner, pair, buyer, alice, bob, prover, other };
}

describe("HELD", function () {
  describe("supply and metadata", function () {
    it("mints the fixed supply to the deployer with 18 decimals", async function () {
      const { held, owner } = await loadFixture(deployFixture);
      expect(await held.name()).to.equal("HeldAt");
      expect(await held.symbol()).to.equal("HELD");
      expect(await held.decimals()).to.equal(18n);
      expect(await held.totalSupply()).to.equal(SUPPLY);
      expect(await held.balanceOf(owner.address)).to.equal(SUPPLY - E(10_000_000));
      expect(await held.owner()).to.equal(owner.address);
    });

    it("stores constructor settings and exposes the hard caps", async function () {
      const { held, prover } = await loadFixture(deployFixture);
      expect(await held.feeBps()).to.equal(30n);
      expect(await held.burnShareBps()).to.equal(8000n);
      expect(await held.proverPool()).to.equal(prover.address);
      expect(await held.MAX_FEE_BPS()).to.equal(100n);
    });

    it("has no external mint function", async function () {
      const { held } = await loadFixture(deployFixture);
      const fns = held.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
      expect(fns.some((n) => /mint/i.test(n))).to.equal(false);
    });

    it("rejects bad constructor arguments", async function () {
      const [, , , , , prover] = await ethers.getSigners();
      const HELD = await ethers.getContractFactory("HELD");
      await expect(HELD.deploy("A", "A", 1n, 101, 8000, prover.address)).to.be.revertedWithCustomError(HELD, "FeeAboveCap");
      await expect(HELD.deploy("A", "A", 1n, 30, 10001, prover.address)).to.be.revertedWithCustomError(HELD, "BurnShareAboveMax");
      await expect(HELD.deploy("A", "A", 1n, 30, 8000, ethers.ZeroAddress)).to.be.revertedWithCustomError(HELD, "ZeroAddress");
    });
  });

  describe("buy fee", function () {
    it("charges 0.30% on a buy from the pair: 80% burned, 20% to prover pool", async function () {
      const { held, pair, buyer, prover } = await loadFixture(deployFixture);
      const amount = E(10_000);
      const fee = E(30); // 0.30%
      const burned = E(24); // 80%
      const toPool = E(6); // 20%
      const supplyBefore = await held.totalSupply();
      const pairBefore = await held.balanceOf(pair.address);

      await expect(held.connect(pair).transfer(buyer.address, amount))
        .to.emit(held, "BuyFeeTaken")
        .withArgs(pair.address, buyer.address, fee, burned, toPool);

      expect(await held.balanceOf(buyer.address)).to.equal(amount - fee);
      expect(await held.balanceOf(prover.address)).to.equal(toPool);
      expect(await held.totalSupply()).to.equal(supplyBefore - burned);
      // The pair is debited exactly `amount`, which keeps AMM accounting consistent.
      expect(await held.balanceOf(pair.address)).to.equal(pairBefore - amount);
    });

    it("also charges when the pair moves tokens via transferFrom", async function () {
      const { held, pair, buyer, alice } = await loadFixture(deployFixture);
      await held.connect(pair).approve(alice.address, E(1000));
      await held.connect(alice).transferFrom(pair.address, buyer.address, E(1000));
      expect(await held.balanceOf(buyer.address)).to.equal(E(997));
    });

    it("does not charge sells (transfers TO the pair)", async function () {
      const { held, pair, alice, prover } = await loadFixture(deployFixture);
      await held.transfer(alice.address, E(1000));
      const pairBefore = await held.balanceOf(pair.address);
      const supplyBefore = await held.totalSupply();
      await expect(held.connect(alice).transfer(pair.address, E(1000))).to.not.emit(held, "BuyFeeTaken");
      expect(await held.balanceOf(pair.address)).to.equal(pairBefore + E(1000));
      expect(await held.balanceOf(prover.address)).to.equal(0n);
      expect(await held.totalSupply()).to.equal(supplyBefore);
    });

    it("does not charge wallet-to-wallet transfers", async function () {
      const { held, alice, bob } = await loadFixture(deployFixture);
      await held.transfer(alice.address, E(500));
      await held.connect(alice).transfer(bob.address, E(500));
      expect(await held.balanceOf(bob.address)).to.equal(E(500));
    });

    it("stops charging once a pair is unset", async function () {
      const { held, pair, buyer } = await loadFixture(deployFixture);
      await expect(held.setPair(pair.address, false)).to.emit(held, "PairUpdated").withArgs(pair.address, false);
      await held.connect(pair).transfer(buyer.address, E(100));
      expect(await held.balanceOf(buyer.address)).to.equal(E(100));
    });

    it("rounds the fee down, then the burn down; the pool gets the remainder", async function () {
      const { held, pair, buyer, prover } = await loadFixture(deployFixture);
      // 1 wei..333 wei at 30 bps -> fee 0, no fee taken at all
      await expect(held.connect(pair).transfer(buyer.address, 333n)).to.not.emit(held, "BuyFeeTaken");
      expect(await held.balanceOf(buyer.address)).to.equal(333n);

      // 334 wei -> fee = floor(334*30/10000) = 1; burn = floor(1*8000/10000) = 0; pool = 1
      const supply0 = await held.totalSupply();
      await expect(held.connect(pair).transfer(buyer.address, 334n))
        .to.emit(held, "BuyFeeTaken")
        .withArgs(pair.address, buyer.address, 1n, 0n, 1n);
      expect(await held.balanceOf(prover.address)).to.equal(1n);
      expect(await held.totalSupply()).to.equal(supply0);

      // 1_666_667 wei -> fee = floor(5000.001) = 5000; burn = 4000; pool = 1000
      await expect(held.connect(pair).transfer(buyer.address, 1_666_667n))
        .to.emit(held, "BuyFeeTaken")
        .withArgs(pair.address, buyer.address, 5000n, 4000n, 1000n);

      // 3_400 wei -> fee = floor(10.2) = 10; burn = 8; pool = 2
      await expect(held.connect(pair).transfer(buyer.address, 3_400n))
        .to.emit(held, "BuyFeeTaken")
        .withArgs(pair.address, buyer.address, 10n, 8n, 2n);

      // 6_000 wei -> fee = 18; burn = floor(14.4) = 14; pool = 4
      const [fee, burned, toPool] = await held.previewBuyFee(6_000n);
      expect([fee, burned, toPool]).to.deep.equal([18n, 14n, 4n]);
    });

    it("conserves value across many random buys (buyer + burn + pool == amount)", async function () {
      const { held, pair, buyer, prover } = await loadFixture(deployFixture);
      let seed = 12345n;
      for (let i = 0; i < 25; i++) {
        seed = (seed * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n;
        const amount = (seed % E(1000)) + 1n;
        const supplyBefore = await held.totalSupply();
        const buyerBefore = await held.balanceOf(buyer.address);
        const poolBefore = await held.balanceOf(prover.address);
        const pairBefore = await held.balanceOf(pair.address);
        await held.connect(pair).transfer(buyer.address, amount);
        const got = (await held.balanceOf(buyer.address)) - buyerBefore;
        const pool = (await held.balanceOf(prover.address)) - poolBefore;
        const burned = supplyBefore - (await held.totalSupply());
        const fee = (amount * 30n) / 10000n;
        expect(got).to.equal(amount - fee);
        expect(burned).to.equal((fee * 8000n) / 10000n);
        expect(got + pool + burned).to.equal(amount);
        expect(pairBefore - (await held.balanceOf(pair.address))).to.equal(amount);
      }
    });

    it("handles burnShareBps of 0% and 100%", async function () {
      const { held, pair, buyer, prover } = await loadFixture(deployFixture);
      await held.setBurnShareBps(0);
      await held.connect(pair).transfer(buyer.address, E(10_000));
      expect(await held.balanceOf(prover.address)).to.equal(E(30));

      await held.setBurnShareBps(10_000);
      const supply = await held.totalSupply();
      await held.connect(pair).transfer(buyer.address, E(10_000));
      expect(await held.balanceOf(prover.address)).to.equal(E(30));
      expect(await held.totalSupply()).to.equal(supply - E(30));
    });

    it("takes no fee when feeBps is 0", async function () {
      const { held, pair, buyer } = await loadFixture(deployFixture);
      await held.setFeeBps(0);
      await expect(held.connect(pair).transfer(buyer.address, E(1000))).to.not.emit(held, "BuyFeeTaken");
      expect(await held.balanceOf(buyer.address)).to.equal(E(1000));
    });

    it("applies a fee at the 1% cap exactly", async function () {
      const { held, pair, buyer } = await loadFixture(deployFixture);
      await held.setFeeBps(100);
      await held.connect(pair).transfer(buyer.address, E(1000));
      expect(await held.balanceOf(buyer.address)).to.equal(E(990));
    });
  });

  describe("settings and caps", function () {
    it("enforces the fee cap", async function () {
      const { held } = await loadFixture(deployFixture);
      await expect(held.setFeeBps(101)).to.be.revertedWithCustomError(held, "FeeAboveCap").withArgs(101, 100);
      await expect(held.setFeeBps(65535)).to.be.revertedWithCustomError(held, "FeeAboveCap");
      await expect(held.setFeeBps(10)).to.emit(held, "FeeBpsUpdated").withArgs(30, 10);
      expect(await held.feeBps()).to.equal(10n);
    });

    it("enforces burn share <= 100%", async function () {
      const { held } = await loadFixture(deployFixture);
      await expect(held.setBurnShareBps(10_001)).to.be.revertedWithCustomError(held, "BurnShareAboveMax");
      await expect(held.setBurnShareBps(5000)).to.emit(held, "BurnShareBpsUpdated").withArgs(8000, 5000);
    });

    it("updates the prover pool and rejects zero", async function () {
      const { held, prover, other } = await loadFixture(deployFixture);
      await expect(held.setProverPool(ethers.ZeroAddress)).to.be.revertedWithCustomError(held, "ZeroAddress");
      await expect(held.setProverPool(other.address))
        .to.emit(held, "ProverPoolUpdated")
        .withArgs(prover.address, other.address);
      expect(await held.proverPool()).to.equal(other.address);
    });

    it("rejects zero address for pair and exemption", async function () {
      const { held } = await loadFixture(deployFixture);
      await expect(held.setPair(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(held, "ZeroAddress");
      await expect(held.setFeeExempt(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(held, "ZeroAddress");
    });

    it("only the owner can change settings", async function () {
      const { held, alice } = await loadFixture(deployFixture);
      const o = held.connect(alice);
      for (const call of [
        () => o.setFeeBps(1),
        () => o.setBurnShareBps(1),
        () => o.setProverPool(alice.address),
        () => o.setPair(alice.address, true),
        () => o.setFeeExempt(alice.address, true),
      ]) {
        await expect(call()).to.be.revertedWithCustomError(held, "OwnableUnauthorizedAccount").withArgs(alice.address);
      }
    });
  });

  describe("exemptions", function () {
    it("skips the fee when the buyer is exempt", async function () {
      const { held, pair, buyer } = await loadFixture(deployFixture);
      await expect(held.setFeeExempt(buyer.address, true)).to.emit(held, "FeeExemptUpdated").withArgs(buyer.address, true);
      await held.connect(pair).transfer(buyer.address, E(1000));
      expect(await held.balanceOf(buyer.address)).to.equal(E(1000));
    });

    it("skips the fee when the pair itself is exempt", async function () {
      const { held, pair, buyer } = await loadFixture(deployFixture);
      await held.setFeeExempt(pair.address, true);
      await held.connect(pair).transfer(buyer.address, E(1000));
      expect(await held.balanceOf(buyer.address)).to.equal(E(1000));
    });

    it("charges again after the exemption is removed", async function () {
      const { held, pair, buyer } = await loadFixture(deployFixture);
      await held.setFeeExempt(buyer.address, true);
      await held.setFeeExempt(buyer.address, false);
      await held.connect(pair).transfer(buyer.address, E(1000));
      expect(await held.balanceOf(buyer.address)).to.equal(E(997));
    });
  });

  describe("ownership", function () {
    it("transfers ownership in two steps", async function () {
      const { held, owner, alice } = await loadFixture(deployFixture);
      await held.transferOwnership(alice.address);
      expect(await held.owner()).to.equal(owner.address);
      expect(await held.pendingOwner()).to.equal(alice.address);
      await held.connect(alice).acceptOwnership();
      expect(await held.owner()).to.equal(alice.address);
      await expect(held.setFeeBps(1)).to.be.revertedWithCustomError(held, "OwnableUnauthorizedAccount");
      await held.connect(alice).setFeeBps(1);
    });

    it("renounce freezes every setting forever, and the fee keeps working", async function () {
      const { held, pair, buyer } = await loadFixture(deployFixture);
      await expect(held.renounceOwnership()).to.emit(held, "OwnershipTransferred");
      expect(await held.owner()).to.equal(ethers.ZeroAddress);
      await expect(held.setFeeBps(0)).to.be.revertedWithCustomError(held, "OwnableUnauthorizedAccount");
      await expect(held.setPair(buyer.address, true)).to.be.revertedWithCustomError(held, "OwnableUnauthorizedAccount");
      await held.connect(pair).transfer(buyer.address, E(1000));
      expect(await held.balanceOf(buyer.address)).to.equal(E(997));
    });
  });
});
