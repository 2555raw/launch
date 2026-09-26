// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Coin} from "../src/Coin.sol";
import {TestCurrency} from "../src/TestCurrency.sol";
import {CurrencyDesk} from "../src/CurrencyDesk.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {Router} from "../src/Router.sol";

abstract contract Base is Test {
    CurrencyDesk desk;
    Launchpad pad;
    Router router;

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

        pad = new Launchpad(owner, desk, treasury, TARGET_USD, 50, 50, 2000, 15);
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
            assertEq(m.reserveQuote, m.realQuote, "pool: reserve is the backing");
            assertEq(m.curveLeft, 0, "pool: nothing left on the curve");
            assertEq(Coin(coin).balanceOf(address(pad)), m.reserveToken, "pool: pad holds the pool coins");
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
