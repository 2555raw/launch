// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Coin} from "../src/Coin.sol";
import {TestCurrency} from "../src/TestCurrency.sol";
import {CurrencyDesk} from "../src/CurrencyDesk.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {Router} from "../src/Router.sol";
import {IUniswapV2Factory, IUniswapV2Pair} from "../src/interfaces/IUniswapV2.sol";

abstract contract Base is Test {
    CurrencyDesk desk;
    Launchpad pad;
    Router router;
    IUniswapV2Factory uniswap;

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

    uint256 constant TARGET_USD = 12_000e18;

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

        uniswap = IUniswapV2Factory(deployUniswapV2Factory());
        pad = new Launchpad(owner, desk, uniswap, treasury, TARGET_USD, 50, 50, 2000, 15);
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

    /// Uniswap's own V2 factory, from the bytecode in its npm package (see uniswap/README.md).
    function deployUniswapV2Factory() internal returns (address f) {
        bytes memory code = vm.parseJsonBytes(vm.readFile("uniswap/UniswapV2Factory.json"), ".bytecode");
        bytes memory init = abi.encodePacked(code, abi.encode(address(0)));
        assembly {
            f := create(0, add(init, 0x20), mload(init))
        }
        require(f != address(0), "uniswap factory");
    }

    /// The coin's pair reserves as (coin, currency).
    function pairReserves(address coin) internal view returns (uint256 rToken, uint256 rQuote) {
        (uint112 r0, uint112 r1,) = IUniswapV2Pair(pad.pairOf(coin)).getReserves();
        (rToken, rQuote) = coin < pad.currencyOf(coin) ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
    }

    /// Mints `usdValue` worth of `token` to `to` through the desk (the desk is the minter).
    function fund(address to, address token, uint256 usdValue) internal {
        uint256 amount = desk.fromUsd(token, usdValue);
        vm.prank(address(desk));
        TestCurrency(token).mint(to, amount);
    }

    function launch(address creator, address currency) internal returns (address coin) {
        vm.prank(creator);
        (coin,) = pad.createCoin("Storm Test", "STORM", "{}", currency, 0, 0);
    }

    function price(address coin) internal view returns (uint256) {
        Launchpad.Market memory m = pad.getMarket(coin);
        return m.reserveQuote * 1e18 / m.reserveToken;
    }

    /// Everything the Proof page checks, for one market.
    function assertMarketHolds(address coin) internal view {
        Launchpad.Market memory m = pad.getMarket(coin);
        if (m.graduated) {
            address pair = pad.pairOf(coin);
            (uint256 rToken, uint256 rQuote) = pairReserves(coin);
            assertEq(m.reserveToken, rToken, "pool: the market reads the pair's reserves");
            assertEq(m.reserveQuote, rQuote, "pool: the market reads the pair's reserves");
            assertEq(m.realQuote, rQuote, "pool: the currency held is the pool's");
            assertEq(m.curveLeft, 0, "pool: nothing left on the curve");
            assertGe(Coin(coin).balanceOf(pair), rToken, "pool: the pair holds its coins");
            assertEq(Coin(coin).balanceOf(address(pad)), 0, "pool: the pad holds none of them");
            // Nobody can take the pool out: every liquidity token but Uniswap's own minimum is burned.
            IUniswapV2Pair p = IUniswapV2Pair(pair);
            assertEq(p.balanceOf(pad.DEAD()) + 1000, p.totalSupply(), "pool: liquidity burned");
        } else {
            assertEq(m.reserveQuote, m.virtualQuote + m.realQuote, "curve: reserve = virtual + backing");
            assertEq(
                m.reserveToken, m.curveLeft + (pad.VIRTUAL_TOKENS() - pad.CURVE_SUPPLY()), "curve: token reserve"
            );
            assertEq(
                Coin(coin).balanceOf(address(pad)), m.curveLeft + pad.POOL_SUPPLY(), "curve: pad holds unsold + pool"
            );
            // If every circulating coin were sold back at once, the backing covers it.
            uint256 circulating = pad.CURVE_SUPPLY() - m.curveLeft;
            if (circulating != 0) {
                uint256 payout = m.reserveQuote * circulating / (m.reserveToken + circulating);
                assertLe(payout, m.realQuote, "curve: backing covers a full sell-back");
            }
        }
    }

    function assertCustody(address currency) internal view {
        assertGe(
            TestCurrency(currency).balanceOf(address(pad)),
            pad.backing(currency) + pad.totalFeesOwed(currency),
            "custody: pad holds backing + fees"
        );
    }
}
