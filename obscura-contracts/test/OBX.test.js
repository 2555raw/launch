const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const E = (n) => ethers.parseUnits(String(n), 18);
const SUPPLY = E(1_000_000_000);

async function deployFixture() {
  const [owner, pair, buyer, alice, bob, prover, other] = await ethers.getSigners();
  const OBX = await ethers.getContractFactory("OBX");
  // Proposal: 0.30% fee, 80% of it burned, 20% to the prover pool.
  const obx = await OBX.deploy("Obscura", "OBX", SUPPLY, 30, 8000, prover.address);
  await obx.setPair(pair.address, true);
  // Stand-in for the AMM pair: an account flagged as a pair, seeded with liquidity.
  await obx.transfer(pair.address, E(10_000_000));
  return { obx, owner, pair, buyer, alice, bob, prover, other };
}

describe("OBX", function () {
  describe("supply and metadata", function () {
    it("mints the fixed supply to the deployer with 18 decimals", async function () {
      const { obx, owner } = await loadFixture(deployFixture);
      expect(await obx.name()).to.equal("Obscura");
      expect(await obx.symbol()).to.equal("OBX");
      expect(await obx.decimals()).to.equal(18n);
      expect(await obx.totalSupply()).to.equal(SUPPLY);
      expect(await obx.balanceOf(owner.address)).to.equal(SUPPLY - E(10_000_000));
      expect(await obx.owner()).to.equal(owner.address);
    });

    it("stores constructor settings and exposes the hard caps", async function () {
      const { obx, prover } = await loadFixture(deployFixture);
      expect(await obx.feeBps()).to.equal(30n);
      expect(await obx.burnShareBps()).to.equal(8000n);
      expect(await obx.proverPool()).to.equal(prover.address);
      expect(await obx.MAX_FEE_BPS()).to.equal(100n);
    });

    it("has no external mint function", async function () {
      const { obx } = await loadFixture(deployFixture);
      const fns = obx.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
      expect(fns.some((n) => /mint/i.test(n))).to.equal(false);
    });

    it("rejects bad constructor arguments", async function () {
      const [, , , , , prover] = await ethers.getSigners();
      const OBX = await ethers.getContractFactory("OBX");
      await expect(OBX.deploy("A", "A", 1n, 101, 8000, prover.address)).to.be.revertedWithCustomError(OBX, "FeeAboveCap");
      await expect(OBX.deploy("A", "A", 1n, 30, 10001, prover.address)).to.be.revertedWithCustomError(OBX, "BurnShareAboveMax");
      await expect(OBX.deploy("A", "A", 1n, 30, 8000, ethers.ZeroAddress)).to.be.revertedWithCustomError(OBX, "ZeroAddress");
    });
  });

  describe("buy fee", function () {
    it("charges 0.30% on a buy from the pair: 80% burned, 20% to prover pool", async function () {
      const { obx, pair, buyer, prover } = await loadFixture(deployFixture);
      const amount = E(10_000);
      const fee = E(30); // 0.30%
      const burned = E(24); // 80%
      const toPool = E(6); // 20%
      const supplyBefore = await obx.totalSupply();
      const pairBefore = await obx.balanceOf(pair.address);

      await expect(obx.connect(pair).transfer(buyer.address, amount))
        .to.emit(obx, "BuyFeeTaken")
        .withArgs(pair.address, buyer.address, fee, burned, toPool);

      expect(await obx.balanceOf(buyer.address)).to.equal(amount - fee);
      expect(await obx.balanceOf(prover.address)).to.equal(toPool);
      expect(await obx.totalSupply()).to.equal(supplyBefore - burned);
      // The pair is debited exactly `amount`, which keeps AMM accounting consistent.
      expect(await obx.balanceOf(pair.address)).to.equal(pairBefore - amount);
    });

    it("also charges when the pair moves tokens via transferFrom", async function () {
      const { obx, pair, buyer, alice } = await loadFixture(deployFixture);
      await obx.connect(pair).approve(alice.address, E(1000));
      await obx.connect(alice).transferFrom(pair.address, buyer.address, E(1000));
      expect(await obx.balanceOf(buyer.address)).to.equal(E(997));
    });

    it("does not charge sells (transfers TO the pair)", async function () {
      const { obx, pair, alice, prover } = await loadFixture(deployFixture);
      await obx.transfer(alice.address, E(1000));
      const pairBefore = await obx.balanceOf(pair.address);
      const supplyBefore = await obx.totalSupply();
      await expect(obx.connect(alice).transfer(pair.address, E(1000))).to.not.emit(obx, "BuyFeeTaken");
      expect(await obx.balanceOf(pair.address)).to.equal(pairBefore + E(1000));
      expect(await obx.balanceOf(prover.address)).to.equal(0n);
      expect(await obx.totalSupply()).to.equal(supplyBefore);
    });

    it("does not charge wallet-to-wallet transfers", async function () {
      const { obx, alice, bob } = await loadFixture(deployFixture);
      await obx.transfer(alice.address, E(500));
      await obx.connect(alice).transfer(bob.address, E(500));
      expect(await obx.balanceOf(bob.address)).to.equal(E(500));
    });

    it("stops charging once a pair is unset", async function () {
      const { obx, pair, buyer } = await loadFixture(deployFixture);
      await expect(obx.setPair(pair.address, false)).to.emit(obx, "PairUpdated").withArgs(pair.address, false);
      await obx.connect(pair).transfer(buyer.address, E(100));
      expect(await obx.balanceOf(buyer.address)).to.equal(E(100));
    });

    it("rounds the fee down, then the burn down; the pool gets the remainder", async function () {
      const { obx, pair, buyer, prover } = await loadFixture(deployFixture);
      // 1 wei..333 wei at 30 bps -> fee 0, no fee taken at all
      await expect(obx.connect(pair).transfer(buyer.address, 333n)).to.not.emit(obx, "BuyFeeTaken");
      expect(await obx.balanceOf(buyer.address)).to.equal(333n);

      // 334 wei -> fee = floor(334*30/10000) = 1; burn = floor(1*8000/10000) = 0; pool = 1
      const supply0 = await obx.totalSupply();
      await expect(obx.connect(pair).transfer(buyer.address, 334n))
        .to.emit(obx, "BuyFeeTaken")
        .withArgs(pair.address, buyer.address, 1n, 0n, 1n);
      expect(await obx.balanceOf(prover.address)).to.equal(1n);
      expect(await obx.totalSupply()).to.equal(supply0);

      // 1_666_667 wei -> fee = floor(5000.001) = 5000; burn = 4000; pool = 1000
      await expect(obx.connect(pair).transfer(buyer.address, 1_666_667n))
        .to.emit(obx, "BuyFeeTaken")
        .withArgs(pair.address, buyer.address, 5000n, 4000n, 1000n);

      // 3_400 wei -> fee = floor(10.2) = 10; burn = 8; pool = 2
      await expect(obx.connect(pair).transfer(buyer.address, 3_400n))
        .to.emit(obx, "BuyFeeTaken")
        .withArgs(pair.address, buyer.address, 10n, 8n, 2n);

      // 6_000 wei -> fee = 18; burn = floor(14.4) = 14; pool = 4
      const [fee, burned, toPool] = await obx.previewBuyFee(6_000n);
      expect([fee, burned, toPool]).to.deep.equal([18n, 14n, 4n]);
    });

    it("conserves value across many random buys (buyer + burn + pool == amount)", async function () {
      const { obx, pair, buyer, prover } = await loadFixture(deployFixture);
      let seed = 12345n;
      for (let i = 0; i < 25; i++) {
        seed = (seed * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n;
        const amount = (seed % E(1000)) + 1n;
        const supplyBefore = await obx.totalSupply();
        const buyerBefore = await obx.balanceOf(buyer.address);
        const poolBefore = await obx.balanceOf(prover.address);
        const pairBefore = await obx.balanceOf(pair.address);
        await obx.connect(pair).transfer(buyer.address, amount);
        const got = (await obx.balanceOf(buyer.address)) - buyerBefore;
        const pool = (await obx.balanceOf(prover.address)) - poolBefore;
        const burned = supplyBefore - (await obx.totalSupply());
        const fee = (amount * 30n) / 10000n;
        expect(got).to.equal(amount - fee);
        expect(burned).to.equal((fee * 8000n) / 10000n);
        expect(got + pool + burned).to.equal(amount);
        expect(pairBefore - (await obx.balanceOf(pair.address))).to.equal(amount);
      }
    });

    it("handles burnShareBps of 0% and 100%", async function () {
      const { obx, pair, buyer, prover } = await loadFixture(deployFixture);
      await obx.setBurnShareBps(0);
      await obx.connect(pair).transfer(buyer.address, E(10_000));
      expect(await obx.balanceOf(prover.address)).to.equal(E(30));

      await obx.setBurnShareBps(10_000);
      const supply = await obx.totalSupply();
      await obx.connect(pair).transfer(buyer.address, E(10_000));
      expect(await obx.balanceOf(prover.address)).to.equal(E(30));
      expect(await obx.totalSupply()).to.equal(supply - E(30));
    });

    it("takes no fee when feeBps is 0", async function () {
      const { obx, pair, buyer } = await loadFixture(deployFixture);
      await obx.setFeeBps(0);
      await expect(obx.connect(pair).transfer(buyer.address, E(1000))).to.not.emit(obx, "BuyFeeTaken");
      expect(await obx.balanceOf(buyer.address)).to.equal(E(1000));
    });

    it("applies a fee at the 1% cap exactly", async function () {
      const { obx, pair, buyer } = await loadFixture(deployFixture);
      await obx.setFeeBps(100);
      await obx.connect(pair).transfer(buyer.address, E(1000));
      expect(await obx.balanceOf(buyer.address)).to.equal(E(990));
    });
  });

  describe("settings and caps", function () {
    it("enforces the fee cap", async function () {
      const { obx } = await loadFixture(deployFixture);
      await expect(obx.setFeeBps(101)).to.be.revertedWithCustomError(obx, "FeeAboveCap").withArgs(101, 100);
      await expect(obx.setFeeBps(65535)).to.be.revertedWithCustomError(obx, "FeeAboveCap");
      await expect(obx.setFeeBps(10)).to.emit(obx, "FeeBpsUpdated").withArgs(30, 10);
      expect(await obx.feeBps()).to.equal(10n);
    });

    it("enforces burn share <= 100%", async function () {
      const { obx } = await loadFixture(deployFixture);
      await expect(obx.setBurnShareBps(10_001)).to.be.revertedWithCustomError(obx, "BurnShareAboveMax");
      await expect(obx.setBurnShareBps(5000)).to.emit(obx, "BurnShareBpsUpdated").withArgs(8000, 5000);
    });

    it("updates the prover pool and rejects zero", async function () {
      const { obx, prover, other } = await loadFixture(deployFixture);
      await expect(obx.setProverPool(ethers.ZeroAddress)).to.be.revertedWithCustomError(obx, "ZeroAddress");
      await expect(obx.setProverPool(other.address))
        .to.emit(obx, "ProverPoolUpdated")
        .withArgs(prover.address, other.address);
      expect(await obx.proverPool()).to.equal(other.address);
    });

    it("rejects zero address for pair and exemption", async function () {
      const { obx } = await loadFixture(deployFixture);
      await expect(obx.setPair(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(obx, "ZeroAddress");
      await expect(obx.setFeeExempt(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(obx, "ZeroAddress");
    });

    it("only the owner can change settings", async function () {
      const { obx, alice } = await loadFixture(deployFixture);
      const o = obx.connect(alice);
      for (const call of [
        () => o.setFeeBps(1),
        () => o.setBurnShareBps(1),
        () => o.setProverPool(alice.address),
        () => o.setPair(alice.address, true),
        () => o.setFeeExempt(alice.address, true),
      ]) {
        await expect(call()).to.be.revertedWithCustomError(obx, "OwnableUnauthorizedAccount").withArgs(alice.address);
      }
    });
  });

  describe("exemptions", function () {
    it("skips the fee when the buyer is exempt", async function () {
      const { obx, pair, buyer } = await loadFixture(deployFixture);
      await expect(obx.setFeeExempt(buyer.address, true)).to.emit(obx, "FeeExemptUpdated").withArgs(buyer.address, true);
      await obx.connect(pair).transfer(buyer.address, E(1000));
      expect(await obx.balanceOf(buyer.address)).to.equal(E(1000));
    });

    it("skips the fee when the pair itself is exempt", async function () {
      const { obx, pair, buyer } = await loadFixture(deployFixture);
      await obx.setFeeExempt(pair.address, true);
      await obx.connect(pair).transfer(buyer.address, E(1000));
      expect(await obx.balanceOf(buyer.address)).to.equal(E(1000));
    });

    it("charges again after the exemption is removed", async function () {
      const { obx, pair, buyer } = await loadFixture(deployFixture);
      await obx.setFeeExempt(buyer.address, true);
      await obx.setFeeExempt(buyer.address, false);
      await obx.connect(pair).transfer(buyer.address, E(1000));
      expect(await obx.balanceOf(buyer.address)).to.equal(E(997));
    });
  });

  describe("ownership", function () {
    it("transfers ownership in two steps", async function () {
      const { obx, owner, alice } = await loadFixture(deployFixture);
      await obx.transferOwnership(alice.address);
      expect(await obx.owner()).to.equal(owner.address);
      expect(await obx.pendingOwner()).to.equal(alice.address);
      await obx.connect(alice).acceptOwnership();
      expect(await obx.owner()).to.equal(alice.address);
      await expect(obx.setFeeBps(1)).to.be.revertedWithCustomError(obx, "OwnableUnauthorizedAccount");
      await obx.connect(alice).setFeeBps(1);
    });

    it("renounce freezes every setting forever, and the fee keeps working", async function () {
      const { obx, pair, buyer } = await loadFixture(deployFixture);
      await expect(obx.renounceOwnership()).to.emit(obx, "OwnershipTransferred");
      expect(await obx.owner()).to.equal(ethers.ZeroAddress);
      await expect(obx.setFeeBps(0)).to.be.revertedWithCustomError(obx, "OwnableUnauthorizedAccount");
      await expect(obx.setPair(buyer.address, true)).to.be.revertedWithCustomError(obx, "OwnableUnauthorizedAccount");
      await obx.connect(pair).transfer(buyer.address, E(1000));
      expect(await obx.balanceOf(buyer.address)).to.equal(E(997));
    });
  });
});
