// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {Coin} from "../src/Coin.sol";
import {TestCurrency} from "../src/TestCurrency.sol";
import {Launchpad} from "../src/Launchpad.sol";

contract LaunchpadTest is Base {
    function test_createCoin_opensAMarketPairedWithTheCurrency() public {
        vm.prank(alice);
        (address coin,) = pad.createCoin("Tokyo Drizzle", "DRIZZLE", '{"d":"x"}', jpy, 0, 0);

        Launchpad.Market memory m = pad.getMarket(coin);
        assertEq(m.creator, alice);
        assertEq(m.currency, jpy);
        assertEq(pad.currencyOf(coin), jpy);
        assertFalse(m.graduated);
        assertEq(m.curveLeft, pad.CURVE_SUPPLY());
        assertEq(m.reserveToken, pad.VIRTUAL_TOKENS());
        assertEq(m.realQuote, 0);
        assertEq(Coin(coin).totalSupply(), pad.TOTAL_SUPPLY());
        assertEq(Coin(coin).balanceOf(address(pad)), pad.TOTAL_SUPPLY());
        assertEq(Coin(coin).name(), "Tokyo Drizzle");
        assertEq(Coin(coin).symbol(), "DRIZZLE");
        assertEq(Coin(coin).launchpad(), address(pad));
        assertEq(pad.coinsCount(), 1);
        assertEq(pad.coinsIn(jpy), 1);
        assertTrue(pad.isCoin(coin));

        // The coin is a minimal proxy (ERC-7511) of the pad's implementation, which is how Verify recognises it.
        bytes memory expected = abi.encodePacked(
            hex"3d3d3d3d363d3d37363d73", pad.coinImplementation(), hex"5af43d3d93803e602a57fd5bf3"
        );
        assertEq(coin.code, expected);
    }

    function test_curveSizeIsTheSameInDollarsForEveryCurrency() public view {
        // Full curve raises TARGET_USD in every currency, at the desk's rate.
        uint256 raiseEur = pad.curveRaiseFor(eur);
        uint256 raiseJpy = pad.curveRaiseFor(jpy);
        uint256 raiseKwd = pad.curveRaiseFor(kwd);
        assertApproxEqRel(desk.toUsd(eur, raiseEur), TARGET_USD, 1e12);
        assertApproxEqRel(desk.toUsd(jpy, raiseJpy), TARGET_USD, 1e12);
        assertApproxEqRel(desk.toUsd(kwd, raiseKwd), TARGET_USD, 1e12);
        assertEq(raiseKwd, 3_660e6); // 12,000 * 0.305, in 6 decimals
    }

    function test_rejectsBadTickersAndNames() public {
        vm.startPrank(alice);
        vm.expectRevert(Launchpad.BadSymbol.selector);
        pad.createCoin("x", "lower", "", eur, 0, 0);
        vm.expectRevert(Launchpad.BadSymbol.selector);
        pad.createCoin("x", "TOOLONGTICKER", "", eur, 0, 0);
        vm.expectRevert(Launchpad.BadSymbol.selector);
        pad.createCoin("x", "", "", eur, 0, 0);
        vm.expectRevert(Launchpad.BadSymbol.selector);
        pad.createCoin("x", "AB C", "", eur, 0, 0);
        vm.expectRevert(Launchpad.BadName.selector);
        pad.createCoin("", "OK", "", eur, 0, 0);
        vm.expectRevert(Launchpad.BadName.selector);
        pad.createCoin("12345678901234567890123456789012345678901", "OK", "", eur, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(Launchpad.CurrencyNotListed.selector, address(0xbeef)));
        pad.createCoin("x", "OK", "", address(0xbeef), 0, 0);
        vm.stopPrank();
    }

    function test_buyThenSellEverything_losesOnlyFees() public {
        address coin = launch(alice, eur);
        vm.warp(block.timestamp + 60); // past the snipe window
        fund(bob, eur, 1_000e18);
        uint256 start = TestCurrency(eur).balanceOf(bob);

        vm.prank(bob);
        (uint256 got,) = pad.buy(coin, start, 0, bob);
        assertMarketHolds(coin);
        assertCustody(eur);

        vm.startPrank(bob);
        Coin(coin).approve(address(pad), got);
        pad.sell(coin, got, 0, bob);
        vm.stopPrank();

        uint256 end = TestCurrency(eur).balanceOf(bob);
        // Two 1% fees, and nothing else leaks.
        assertApproxEqRel(end, start * 99 / 100 * 99 / 100, 1e14);
        assertLe(end, start);
        Launchpad.Market memory m = pad.getMarket(coin);
        assertEq(m.curveLeft, pad.CURVE_SUPPLY());
        assertLe(m.realQuote, 10); // rounding dust stays with the market
        assertMarketHolds(coin);
        assertCustody(eur);
    }

    function test_priceRisesWithEveryBuyAndFallsWithEverySell() public {
        address coin = launch(alice, usd);
        vm.warp(block.timestamp + 60);
        fund(bob, usd, 5_000e18);
        uint256 p0 = price(coin);
        vm.prank(bob);
        (uint256 got,) = pad.buy(coin, 1_000e18, 0, bob);
        uint256 p1 = price(coin);
        assertGt(p1, p0);
        vm.startPrank(bob);
        Coin(coin).approve(address(pad), got);
        pad.sell(coin, got / 2, 0, bob);
        vm.stopPrank();
        assertLt(price(coin), p1);
    }

    function test_snipeTaxDecaysLinearlyOverTheWindow() public {
        address coin = launch(alice, usd);
        assertEq(pad.snipeTaxNow(coin), 2000);
        vm.warp(block.timestamp + 3);
        assertEq(pad.snipeTaxNow(coin), 1600);
        vm.warp(block.timestamp + 4);
        assertEq(pad.snipeTaxNow(coin), 1066);
        vm.warp(block.timestamp + 8);
        assertEq(pad.snipeTaxNow(coin), 0);
    }

    function test_snipeTaxGoesToTreasury_andFirstBuyIsExempt() public {
        fund(alice, usd, 1_000e18);
        vm.prank(alice);
        (address coin, uint256 firstGot) = pad.createCoin("Gale", "GALE", "", usd, 100e18, 0);
        assertGt(firstGot, 0);
        // First buy paid only the 1% trade fee.
        assertEq(pad.feesOwed(treasury, usd), 0.5e18);
        assertEq(pad.feesOwed(alice, usd), 0.5e18);

        fund(bob, usd, 1_000e18);
        vm.prank(bob);
        pad.buy(coin, 100e18, 0, bob);
        // Bob bought in the same second: 20% snipe tax on top of the 1% fee.
        assertEq(pad.feesOwed(treasury, usd), 0.5e18 + 0.5e18 + 20e18);
        assertEq(pad.feesOwed(alice, usd), 1e18);
        assertMarketHolds(coin);
        assertCustody(usd);
    }

    function test_graduation_keepsThePrice_andRefundsTheRest() public {
        address coin = launch(alice, eur);
        vm.warp(block.timestamp + 60);
        fund(bob, eur, 1_000_000e18);
        uint256 before = TestCurrency(eur).balanceOf(bob);

        Launchpad.Market memory m0 = pad.getMarket(coin);
        // Price at the last coin of the curve, straight from the curve formula.
        uint256 lastPrice = (m0.virtualQuote * pad.VIRTUAL_TOKENS() / (pad.VIRTUAL_TOKENS() - pad.CURVE_SUPPLY()))
            * 1e18 / (pad.VIRTUAL_TOKENS() - pad.CURVE_SUPPLY());

        vm.prank(bob);
        (uint256 got, uint256 used) = pad.buy(coin, before, 0, bob);

        assertEq(got, pad.CURVE_SUPPLY());
        assertLt(used, before);
        assertEq(TestCurrency(eur).balanceOf(bob), before - used);

        Launchpad.Market memory m = pad.getMarket(coin);
        assertTrue(m.graduated);
        assertEq(m.reserveToken, pad.POOL_SUPPLY());
        assertEq(m.reserveQuote, m.realQuote);
        // The full curve raised the target in dollars (net of fees).
        assertApproxEqRel(desk.toUsd(eur, m.realQuote), TARGET_USD, 1e12);
        // No jump at graduation.
        assertApproxEqRel(price(coin), lastPrice, 1e12);
        assertMarketHolds(coin);
        assertCustody(eur);

        // The pool trades both ways afterwards.
        vm.startPrank(bob);
        Coin(coin).approve(address(pad), type(uint256).max);
        uint256 out = pad.sell(coin, 10_000_000e18, 0, bob);
        assertGt(out, 0);
        pad.buy(coin, out, 0, bob);
        vm.stopPrank();
        assertMarketHolds(coin);
        assertCustody(eur);
    }

    function test_feesAccrue_andCreatorsClaimThem() public {
        address coin = launch(alice, jpy);
        vm.warp(block.timestamp + 60);
        fund(bob, jpy, 500e18);
        uint256 spend = TestCurrency(jpy).balanceOf(bob);
        vm.prank(bob);
        pad.buy(coin, spend, 0, bob);

        uint256 owed = pad.feesOwed(alice, jpy);
        assertEq(owed, spend * 50 / 10_000);
        vm.prank(alice);
        pad.claimFees(jpy);
        assertEq(TestCurrency(jpy).balanceOf(alice), owed);
        assertEq(pad.feesOwed(alice, jpy), 0);

        vm.prank(treasury);
        pad.claimFees(jpy);
        assertEq(pad.totalFeesOwed(jpy), 0);
        assertCustody(jpy);

        vm.expectRevert(Launchpad.ZeroAmount.selector);
        vm.prank(alice);
        pad.claimFees(jpy);
    }

    function test_slippageProtection() public {
        address coin = launch(alice, usd);
        vm.warp(block.timestamp + 60);
        fund(bob, usd, 100e18);
        (uint256 expected,,,) = pad.quoteBuy(coin, 100e18);
        vm.prank(bob);
        vm.expectRevert(Launchpad.Slippage.selector);
        pad.buy(coin, 100e18, expected + 1, bob);
        vm.prank(bob);
        (uint256 got,) = pad.buy(coin, 100e18, expected, bob);
        assertEq(got, expected);
    }

    function test_sellFor_isRouterOnly() public {
        address coin = launch(alice, usd);
        vm.expectRevert(Launchpad.NotRouter.selector);
        pad.sellFor(bob, coin, 1, 0, bob);
    }

    function test_quotesMatchExecution() public {
        address coin = launch(alice, kwd);
        vm.warp(block.timestamp + 5);
        fund(bob, kwd, 2_000e18);
        uint256 amount = TestCurrency(kwd).balanceOf(bob) / 3;
        (uint256 qOut, uint256 qUsed,,) = pad.quoteBuy(coin, amount);
        vm.prank(bob);
        (uint256 got, uint256 used) = pad.buy(coin, amount, 0, bob);
        assertEq(got, qOut);
        assertEq(used, qUsed);

        (uint256 qSell,) = pad.quoteSell(coin, got / 2);
        vm.startPrank(bob);
        Coin(coin).approve(address(pad), got);
        uint256 out = pad.sell(coin, got / 2, 0, bob);
        vm.stopPrank();
        assertEq(out, qSell);
        assertMarketHolds(coin);
        assertCustody(kwd);
    }

    function test_adminBounds() public {
        vm.startPrank(owner);
        vm.expectRevert(Launchpad.FeeTooHigh.selector);
        pad.setFees(300, 201);
        vm.expectRevert(Launchpad.BadSnipe.selector);
        pad.setSnipe(5001, 15);
        vm.expectRevert(Launchpad.BadSnipe.selector);
        pad.setSnipe(100, 301);
        pad.setFees(100, 100);
        assertEq(pad.protocolFeeBps(), 100);
        vm.stopPrank();

        vm.expectRevert();
        vm.prank(alice);
        pad.setFees(0, 0);
    }

    function test_coinImplementationCannotBeInitialized() public {
        Coin impl = Coin(pad.coinImplementation());
        vm.expectRevert(Coin.AlreadyInitialized.selector);
        impl.initialize("x", "X", 1);
    }

    function test_getCoinsPages() public {
        for (uint256 i; i < 5; ++i) {
            launch(alice, i % 2 == 0 ? eur : jpy);
        }
        Launchpad.CoinView[] memory page = pad.getCoins(1, 3);
        assertEq(page.length, 3);
        assertEq(page[0].coin, pad.allCoins(1));
        assertEq(page[0].symbol, "STORM");
        assertEq(page[1].currency, eur);
        assertEq(pad.getCoins(10, 3).length, 0);
        assertEq(pad.getCoins(4, 10).length, 1);
    }

    /// Buying and selling back can never pay out more than was put in.
    function testFuzz_noFreeMoney(uint256 spend, uint256 sellPart, uint256 waitSeconds) public {
        spend = bound(spend, 1e12, 50_000e18);
        sellPart = bound(sellPart, 1, 100);
        waitSeconds = bound(waitSeconds, 0, 30);
        address coin = launch(alice, usd);
        vm.warp(block.timestamp + waitSeconds);
        fund(bob, usd, spend);
        uint256 start = TestCurrency(usd).balanceOf(bob);

        vm.prank(bob);
        (uint256 got,) = pad.buy(coin, start, 0, bob);
        uint256 toSell = got * sellPart / 100;
        if (toSell != 0) {
            vm.startPrank(bob);
            Coin(coin).approve(address(pad), toSell);
            pad.sell(coin, toSell, 0, bob);
            vm.stopPrank();
        }
        assertLe(TestCurrency(usd).balanceOf(bob), start);
        assertMarketHolds(coin);
        assertCustody(usd);
    }
}
