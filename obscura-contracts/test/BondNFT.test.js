const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const E = (n) => ethers.parseUnits(String(n), 18);
const MIN_HOLD = E(1000);
const MAX_MIN_HOLD = E(1_000_000);
const seal = (s) => ethers.sha256(ethers.toUtf8Bytes(s)); // 32-byte SHA-256, like the browser does

async function deploy(soulbound) {
  const [owner, holder, poor, other, prover] = await ethers.getSigners();
  const obx = await (await ethers.getContractFactory("OBX")).deploy("Obscura", "OBX", E(1_000_000_000), 30, 8000, prover.address);
  const bond = await (await ethers.getContractFactory("BondNFT")).deploy(
    "Obscura Bond",
    "OBOND",
    await obx.getAddress(),
    MIN_HOLD,
    MAX_MIN_HOLD,
    soulbound
  );
  await obx.transfer(holder.address, MIN_HOLD);
  await obx.transfer(poor.address, MIN_HOLD - 1n);
  return { obx, bond, owner, holder, poor, other };
}
const transferable = () => deploy(false);
const soulboundFx = () => deploy(true);

function decodeTokenURI(uri) {
  const prefix = "data:application/json;base64,";
  expect(uri.startsWith(prefix)).to.equal(true);
  return JSON.parse(Buffer.from(uri.slice(prefix.length), "base64").toString("utf8"));
}

describe("BondNFT", function () {
  describe("deployment", function () {
    it("stores constructor settings", async function () {
      const { obx, bond, owner } = await loadFixture(transferable);
      expect(await bond.obx()).to.equal(await obx.getAddress());
      expect(await bond.minHold()).to.equal(MIN_HOLD);
      expect(await bond.maxMinHold()).to.equal(MAX_MIN_HOLD);
      expect(await bond.soulbound()).to.equal(false);
      expect(await bond.owner()).to.equal(owner.address);
      expect(await bond.name()).to.equal("Obscura Bond");
    });

    it("rejects a zero OBX address and an out-of-range minHold", async function () {
      const F = await ethers.getContractFactory("BondNFT");
      const [a] = await ethers.getSigners();
      await expect(F.deploy("B", "B", ethers.ZeroAddress, 1, 10, false)).to.be.revertedWithCustomError(F, "ZeroAddress");
      await expect(F.deploy("B", "B", a.address, 0, 10, false)).to.be.revertedWithCustomError(F, "MinHoldOutOfRange");
      await expect(F.deploy("B", "B", a.address, 11, 10, false)).to.be.revertedWithCustomError(F, "MinHoldOutOfRange");
    });
  });

  describe("hold gate", function () {
    it("mints to a wallet holding exactly minHold", async function () {
      const { bond, holder } = await loadFixture(transferable);
      const s = seal("asset-1");
      await expect(bond.connect(holder).mint(s)).to.emit(bond, "Bonded").withArgs(1n, holder.address, s);
      expect(await bond.ownerOf(1n)).to.equal(holder.address);
      expect(await bond.totalMinted()).to.equal(1n);
    });

    it("rejects a wallet holding 1 wei less than minHold", async function () {
      const { bond, poor } = await loadFixture(transferable);
      await expect(bond.connect(poor).mint(seal("x")))
        .to.be.revertedWithCustomError(bond, "InsufficientOBX")
        .withArgs(MIN_HOLD - 1n, MIN_HOLD);
    });

    it("rejects a wallet with no OBX", async function () {
      const { bond, other } = await loadFixture(transferable);
      await expect(bond.connect(other).mint(seal("x"))).to.be.revertedWithCustomError(bond, "InsufficientOBX").withArgs(0n, MIN_HOLD);
    });

    it("owner can move minHold within 1..maxMinHold only", async function () {
      const { bond, poor, other } = await loadFixture(transferable);
      await expect(bond.setMinHold(0)).to.be.revertedWithCustomError(bond, "MinHoldOutOfRange");
      await expect(bond.setMinHold(MAX_MIN_HOLD + 1n)).to.be.revertedWithCustomError(bond, "MinHoldOutOfRange");
      await expect(bond.connect(other).setMinHold(1)).to.be.revertedWithCustomError(bond, "OwnableUnauthorizedAccount");
      await expect(bond.setMinHold(MIN_HOLD - 1n)).to.emit(bond, "MinHoldUpdated").withArgs(MIN_HOLD, MIN_HOLD - 1n);
      await bond.connect(poor).mint(seal("now-ok"));
      await bond.setMinHold(MAX_MIN_HOLD);
      expect(await bond.minHold()).to.equal(MAX_MIN_HOLD);
    });

    it("after renounce, minHold is frozen", async function () {
      const { bond } = await loadFixture(transferable);
      await bond.renounceOwnership();
      await expect(bond.setMinHold(1)).to.be.revertedWithCustomError(bond, "OwnableUnauthorizedAccount");
    });
  });

  describe("seal codes", function () {
    it("rejects the zero seal code", async function () {
      const { bond, holder } = await loadFixture(transferable);
      await expect(bond.connect(holder).mint(ethers.ZeroHash)).to.be.revertedWithCustomError(bond, "ZeroSealCode");
    });

    it("rejects a duplicate seal code, even from another holder", async function () {
      const { obx, bond, holder, other } = await loadFixture(transferable);
      const s = seal("dup");
      await bond.connect(holder).mint(s);
      await expect(bond.connect(holder).mint(s)).to.be.revertedWithCustomError(bond, "SealCodeAlreadyBonded").withArgs(s, 1n);
      await obx.transfer(other.address, MIN_HOLD);
      await expect(bond.connect(other).mint(s)).to.be.revertedWithCustomError(bond, "SealCodeAlreadyBonded");
    });

    it("sealCodeOf and tokenIdOfSeal map both ways; ids are sequential", async function () {
      const { bond, holder } = await loadFixture(transferable);
      const a = seal("a");
      const b = seal("b");
      await bond.connect(holder).mint(a);
      await bond.connect(holder).mint(b);
      expect(await bond.sealCodeOf(1n)).to.equal(a);
      expect(await bond.sealCodeOf(2n)).to.equal(b);
      expect(await bond.tokenIdOfSeal(a)).to.equal(1n);
      expect(await bond.tokenIdOfSeal(b)).to.equal(2n);
      expect(await bond.tokenIdOfSeal(seal("never"))).to.equal(0n);
      expect(await bond.balanceOf(holder.address)).to.equal(2n);
    });

    it("sealCodeOf and tokenURI revert for a token that does not exist", async function () {
      const { bond } = await loadFixture(transferable);
      await expect(bond.sealCodeOf(1n)).to.be.revertedWithCustomError(bond, "ERC721NonexistentToken");
      await expect(bond.tokenURI(1n)).to.be.revertedWithCustomError(bond, "ERC721NonexistentToken");
    });
  });

  describe("tokenURI", function () {
    it("decodes to JSON with name 'Bond #id' and the seal code attribute", async function () {
      const { bond, holder } = await loadFixture(transferable);
      const s = seal("tokenuri");
      await bond.connect(holder).mint(s);
      const meta = decodeTokenURI(await bond.tokenURI(1n));
      expect(meta.name).to.equal("Bond #1");
      expect(meta.attributes).to.deep.equal([{ trait_type: "Seal code", value: s }]);
      expect(meta.image.startsWith("data:image/svg+xml;base64,")).to.equal(true);
      const svg = Buffer.from(meta.image.split(",")[1], "base64").toString("utf8");
      expect(svg).to.contain("<svg");
      expect(svg).to.contain("Bond #1");
      expect(svg).to.contain(s.slice(0, 34));
      expect(svg).to.contain(s.slice(34));
    });

    it("works for a seal code with leading zero bytes and a multi-digit id", async function () {
      const { bond, holder } = await loadFixture(transferable);
      for (let i = 0; i < 11; i++) await bond.connect(holder).mint(seal("n" + i));
      const s = "0x0000000000000000000000000000000000000000000000000000000000000001";
      await bond.connect(holder).mint(s);
      const meta = decodeTokenURI(await bond.tokenURI(12n));
      expect(meta.name).to.equal("Bond #12");
      expect(meta.attributes[0].value).to.equal(s);
    });
  });

  describe("transferability", function () {
    it("transferable mode: bonds move and keep their seal code", async function () {
      const { bond, holder, other } = await loadFixture(transferable);
      const s = seal("move");
      await bond.connect(holder).mint(s);
      await bond.connect(holder).transferFrom(holder.address, other.address, 1n);
      expect(await bond.ownerOf(1n)).to.equal(other.address);
      expect(await bond.sealCodeOf(1n)).to.equal(s);
    });

    it("soulbound mode: mint works, every transfer path reverts", async function () {
      const { bond, holder, other } = await loadFixture(soulboundFx);
      expect(await bond.soulbound()).to.equal(true);
      await bond.connect(holder).mint(seal("sb"));
      expect(await bond.ownerOf(1n)).to.equal(holder.address);
      await expect(bond.connect(holder).transferFrom(holder.address, other.address, 1n)).to.be.revertedWithCustomError(bond, "Soulbound");
      await expect(
        bond.connect(holder)["safeTransferFrom(address,address,uint256)"](holder.address, other.address, 1n)
      ).to.be.revertedWithCustomError(bond, "Soulbound");
      await bond.connect(holder).approve(other.address, 1n);
      await expect(bond.connect(other).transferFrom(holder.address, other.address, 1n)).to.be.revertedWithCustomError(bond, "Soulbound");
      expect(await bond.ownerOf(1n)).to.equal(holder.address);
    });
  });

  describe("integration with OBX", function () {
    it("a buyer from the pair who nets >= minHold after the fee can mint", async function () {
      const { obx, bond, other } = await loadFixture(transferable);
      const [, , , , , pair] = await ethers.getSigners();
      await obx.setPair(pair.address, true);
      await obx.transfer(pair.address, E(10_000));
      // Buying exactly minHold nets 0.30% less, which is below the gate.
      await obx.connect(pair).transfer(other.address, MIN_HOLD);
      await expect(bond.connect(other).mint(seal("i"))).to.be.revertedWithCustomError(bond, "InsufficientOBX");
      await obx.connect(pair).transfer(other.address, E(10));
      await expect(bond.connect(other).mint(seal("i"))).to.emit(bond, "Bonded");
    });
  });
});
