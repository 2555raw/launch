// Deploys the real Uniswap v4 PoolManager, a 6-decimal "USDG" test token, the factory and
// the router to the local chain, then writes a copy of the site pointed at them into the temp folder.
const path = require('path'); const fs = require('fs'); const os = require('os');
const { ethers } = require('ethers');
const build = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'build', n + '.json'), 'utf8'));
(async () => {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545', undefined, { cacheTimeout: -1 });
  const [deployer, , , treasury] = await Promise.all([0, 1, 2, 3].map((i) => provider.getSigner(i)));
  const dep = async (n, ...a) => { const b = build(n); const c = await new ethers.ContractFactory(b.abi, b.bytecode, deployer).deploy(...a); await c.waitForDeployment(); return c; };
  const pm = await dep('PoolManager', deployer.address);
  const usd = await dep('MockToken', 'Global Dollar', 'USDG', 6);
  const factory = await dep('NebariFactory', await pm.getAddress(), treasury.address, 1000n);
  const router = await dep('NebariRouter', await pm.getAddress());
  await (await usd.mint(deployer.address, ethers.parseUnits('1000000', 6))).wait();
  const out = { poolManager: await pm.getAddress(), testToken: await usd.getAddress(), factory: await factory.getAddress(), router: await router.getAddress(), deployer: deployer.address, treasury: treasury.address };
  const t = new ethers.Contract(out.testToken, ['function symbol() view returns (string)', 'function name() view returns (string)', 'function decimals() view returns (uint8)'], provider);
  out.testMeta = { symbol: await t.symbol().catch(() => '?'), name: await t.name().catch(() => '?'), decimals: Number(await t.decimals().catch(() => 18)) };
  fs.writeFileSync(path.join(__dirname, 'deployed.json'), JSON.stringify(out, null, 2));

  // copy the site (without contracts/ and brand/) and point its config at the local chain
  const siteSrc = path.resolve(__dirname, '..', '..', '..');
  const siteDst = path.join(os.tmpdir(), 'nebari-e2e-site');
  fs.rmSync(siteDst, { recursive: true, force: true });
  fs.cpSync(siteSrc, siteDst, { recursive: true, filter: (p) => !/[\\/](contracts|brand)([\\/]|$)/.test(path.relative(siteSrc, p)) });
  let cfg = fs.readFileSync(path.join(siteDst, 'config.js'), 'utf8');
  cfg = cfg.replace(/rpc: '[^']*'/, "rpc: 'http://127.0.0.1:8767/rpc'")
    .replace(/explorer: '[^']*'/, "explorer: 'http://127.0.0.1:8767/explorer'")
    .replace(/poolManager: '0x[0-9a-fA-F]+'/, `poolManager: '${out.poolManager}'`)
    .replace(/factory: '[^']*'/, `factory: '${out.factory}'`)
    .replace(/router: '[^']*'/, `router: '${out.router}'`)
    .replace(/(symbol: 'USDG',[^}]*?address: )'0x[0-9a-fA-F]+'/, `$1'${out.testToken}'`);
  fs.writeFileSync(path.join(siteDst, 'config.js'), cfg);
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
