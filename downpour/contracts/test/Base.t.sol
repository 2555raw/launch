// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Coin} from "../src/Coin.sol";
import {TestCurrency} from "../src/TestCurrency.sol";
import {CurrencyDesk} from "../src/CurrencyDesk.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {Router} from "../src/Router.sol";
import {INonfungiblePositionManager, IUniswapV3Factory, IUniswapV3Pool} from "../src/interfaces/IUniswapV3.sol";
import {WETH9} from "./mocks/WETH9.sol";

abstract contract Base is Test {
    CurrencyDesk desk;
    Launchpad pad;
    Router router;
    IUniswapV3Factory factory;
    INonfungiblePositionManager positions;
    WETH9 weth;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    address usd;
    address eur;
    address jpy;
    address kwd; // 6 decimals, to exercise decimal handling
    address vnd;

    uint256 constant START_MCAP_USD = 4_000e18;

    function setUp() public virtual {
        vm.warp(1_750_000_000);
        vm.startPrank(owner);
        desk = new CurrencyDesk(owner, 10, 1_000e18, 1 hours);

        CurrencyDesk.NewTestCurrency[] memory list = new CurrencyDesk.NewTestCurrency[](5);
        list[0] = CurrencyDesk.NewTestCurrency("USD", "Test US Dollar", "tUSD", 18, 1e18);
        list[1] = CurrencyDesk.NewTestCurrency("EUR", "Test Euro", "tEUR", 18, 0.86e18);
        list[2] = CurrencyDesk.NewTestCurrency("JPY", "Test Yen", "tJPY", 18, 148e18);
        list[3] = CurrencyDesk.NewTestCurrency("KWD", "Test Kuwaiti Dinar", "tKWD", 6, 0.305e18);
        list[4] = CurrencyDesk.NewTestCurrency("VND", "Test Dong", "tVND", 18, 26_300e18);
        address[] memory tokens = desk.createTestCurrencies(list);
        (usd, eur, jpy, kwd, vnd) = (tokens[0], tokens[1], tokens[2], tokens[3], tokens[4]);

        (factory, positions, weth) = deployUniswapV3();
        pad = new Launchpad(owner, desk, positions, treasury, START_MCAP_USD);
        router = new Router(pad);
        pad.setRouter(address(router));
        vm.stopPrank();

        address[3] memory people = [alice, bob, carol];
        for (uint256 i; i < people.length; ++i) {
            vm.startPrank(people[i]);
            TestCurrency(usd).approve(address(pad), type(uint256).max);
            TestCurrency(eur).approve(address(pad), type(uint256).max);
            TestCurrency(jpy).approve(address(pad), type(uint256).max);
            TestCurrency(kwd).approve(address(pad), type(uint256).max);
            TestCurrency(vnd).approve(address(pad), type(uint256).max);
            TestCurrency(usd).approve(address(router), type(uint256).max);
            TestCurrency(eur).approve(address(router), type(uint256).max);
            TestCurrency(jpy).approve(address(router), type(uint256).max);
            TestCurrency(kwd).approve(address(router), type(uint256).max);
            TestCurrency(vnd).approve(address(router), type(uint256).max);
            vm.stopPrank();
        }
    }

    /// Uniswap's own V3 factory and position manager, from the bytecode in their npm packages.
    function deployUniswapV3() internal returns (IUniswapV3Factory f, INonfungiblePositionManager p, WETH9 w) {
        bytes memory fcode = vm.parseJsonBytes(
            vm.readFile("../node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
            ".bytecode"
        );
        address fa;
        assembly {
            fa := create(0, add(fcode, 0x20), mload(fcode))
        }
        require(fa != address(0), "v3 factory");
        w = new WETH9();
        bytes memory pcode = vm.parseJsonBytes(
            vm.readFile(
                "../node_modules/@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"
            ),
            ".bytecode"
        );
        bytes memory init = abi.encodePacked(pcode, abi.encode(fa, address(w), address(0)));
        address pa;
        assembly {
            pa := create(0, add(init, 0x20), mload(init))
        }
        require(pa != address(0), "position manager");
        f = IUniswapV3Factory(fa);
        p = INonfungiblePositionManager(pa);
    }

    /// Mints `usdValue` worth of `token` to `to` through the desk (the desk is the minter).
    function fund(address to, address token, uint256 usdValue) internal {
        uint256 amount = desk.fromUsd(token, usdValue);
        vm.prank(address(desk));
        TestCurrency(token).mint(to, amount);
    }

    /// A salt whose coin address sorts below the currency, as the site finds one.
    function saltFor(address currency) internal view returns (bytes32 salt) {
        for (uint256 i; i < 8192; ++i) {
            salt = keccak256(abi.encode("starmint", currency, i, address(this)));
            if (pad.coinAddress(salt) < currency) return salt;
        }
        revert("no salt");
    }

    function launch(address creator, address currency) internal returns (address coin) {
        return launchWith(creator, currency, 0);
    }

    function launchWith(address creator, address currency, uint256 firstBuy) internal returns (address coin) {
        bytes32 salt = saltFor(currency);
        vm.prank(creator);
        (coin,) = pad.createCoin("Storm Test", "STORM", "{\"name\":\"Storm Test\"}", currency, salt, firstBuy, 0);
    }

    /// Price in currency raw units per whole coin, from the pad's virtual reserves.
    function price(address coin) internal view returns (uint256) {
        (uint256 rToken, uint256 rQuote) = pad.reserves(coin);
        return rQuote * 1e18 / rToken;
    }

    function poolOf(address coin) internal view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(pad.poolOf(coin));
    }

    /// Everything the Proof page checks, for one market: the position is the pad's, sits
    /// above the launch price to the top, and the pool holds the coins and currency it says.
    function assertMarketHolds(address coin) internal view {
        Launchpad.Market memory m = pad.getMarket(coin);
        assertEq(positions.ownerOf(m.tokenId), address(pad), "position: the pad owns it");
        (,, address t0, address t1, uint24 fee, int24 lower, int24 upper, uint128 liq,,,,) = positions.positions(m.tokenId);
        assertEq(t0, coin, "position: coin is token0");
        assertEq(t1, m.currency, "position: currency is token1");
        assertEq(fee, pad.POOL_FEE(), "position: 1% pool");
        assertEq(lower, m.tickLower, "position: from the launch tick");
        assertEq(upper, pad.TICK_TOP(), "position: to the top");
        assertGt(liq, 0, "position: has liquidity");
        assertEq(Coin(coin).balanceOf(address(pad)) < 1e18, true, "pad: holds at most dust of the coin");
        (uint256 rToken,) = pad.reserves(coin);
        assertLe(rToken, Coin(coin).balanceOf(m.pool) + 1e18, "pool: holds the coins the curve says are left");
    }
}
