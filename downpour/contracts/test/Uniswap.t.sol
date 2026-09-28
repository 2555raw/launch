// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {Coin} from "../src/Coin.sol";
import {TestCurrency} from "../src/TestCurrency.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {IUniswapV2Pair} from "../src/interfaces/IUniswapV2.sol";

/// Graduation into Uniswap V2, and trading afterwards.
contract UniswapTest is Base {
    address mallory = makeAddr("mallory");

    /// Buys out the rest of the curve for `who`, in the coin's currency.
    function sellOut(address coin, address who) internal {
        address cur = pad.currencyOf(coin);
        fund(who, cur, 1_000_000e18);
        vm.startPrank(who);
        TestCurrency(cur).approve(address(pad), type(uint256).max);
        pad.buy(coin, TestCurrency(cur).balanceOf(who), 0, who);
        vm.stopPrank();
        assertTrue(pad.getMarket(coin).graduated);
    }

    function test_theCoinsPairIsCreatedAtLaunch_andKnowsIt() public {
        address coin = launch(alice, jpy);
        address pair = pad.pairOf(coin);
        assertEq(pair, uniswap.getPair(coin, jpy));
        assertEq(Coin(coin).pair(), pair);
        assertFalse(Coin(coin).graduated());
        (uint256 rToken, uint256 rQuote) = pairReserves(coin);
        assertEq(rToken + rQuote, 0, "empty until graduation");
    }

    function test_graduation_opensThePoolAtTheCurvesLastPrice_andBurnsTheLiquidity() public {
        address coin = launch(alice, eur);
        vm.warp(block.timestamp + 60);
        Launchpad.Market memory m0 = pad.getMarket(coin);
        uint256 lastPrice = (m0.virtualQuote * pad.VIRTUAL_TOKENS() / (pad.VIRTUAL_TOKENS() - pad.CURVE_SUPPLY()))
            * 1e18 / (pad.VIRTUAL_TOKENS() - pad.CURVE_SUPPLY());
        uint256 backingBefore = pad.backing(eur);

        sellOut(coin, bob);

        address pair = pad.pairOf(coin);
        (uint256 rToken, uint256 rQuote) = pairReserves(coin);
        assertEq(rToken, pad.POOL_SUPPLY(), "the 200M held back");
        assertApproxEqRel(desk.toUsd(eur, rQuote), TARGET_USD, 1e12, "the curve's backing");
        assertApproxEqRel(rQuote * 1e18 / rToken, lastPrice, 1e12, "no jump at graduation");
        assertTrue(Coin(coin).graduated());
        assertEq(pad.backing(eur), backingBefore, "the backing left the pad with the pool");
        assertEq(TestCurrency(eur).balanceOf(pair), rQuote);
        assertMarketHolds(coin);
        assertCustody(eur);
    }

    function test_nothingReachesThePairBeforeGraduation() public {
        address coin = launch(alice, usd);
        vm.warp(block.timestamp + 60);
        fund(mallory, usd, 500e18);
        vm.startPrank(mallory);
        TestCurrency(usd).approve(address(pad), type(uint256).max);
        pad.buy(coin, desk.fromUsd(usd, 500e18), 0, mallory);
        vm.stopPrank();
        address pair = pad.pairOf(coin);
        uint256 held = Coin(coin).balanceOf(mallory);

        vm.prank(mallory);
        vm.expectRevert(Coin.PoolNotOpen.selector);
        Coin(coin).transfer(pair, held);

        vm.prank(mallory);
        Coin(coin).approve(bob, held);
        vm.prank(bob);
        vm.expectRevert(Coin.PoolNotOpen.selector);
        Coin(coin).transferFrom(mallory, pair, held);

        // Everywhere else it moves freely.
        vm.prank(mallory);
        Coin(coin).transfer(carol, held / 2);
        assertEq(Coin(coin).balanceOf(carol), held / 2);

        sellOut(coin, bob);
        vm.prank(mallory);
        Coin(coin).transfer(pair, 1e18);
    }

    function test_onlyThePadGraduatesACoin() public {
        address coin = launch(alice, usd);
        vm.prank(mallory);
        vm.expectRevert(Coin.NotLaunchpad.selector);
        Coin(coin).graduate();
    }

    function test_currencySentToThePairEarly_goesToTheTreasury() public {
        address coin = launch(alice, usd);
        vm.warp(block.timestamp + 60);
        address pair = pad.pairOf(coin);
        fund(mallory, usd, 5_000e18);
        uint256 gift = TestCurrency(usd).balanceOf(mallory);
        vm.prank(mallory);
        TestCurrency(usd).transfer(pair, gift);
        uint256 before = TestCurrency(usd).balanceOf(treasury);

        sellOut(coin, bob);

        assertEq(TestCurrency(usd).balanceOf(treasury), before + gift, "skimmed to the treasury");
        (uint256 rToken, uint256 rQuote) = pairReserves(coin);
        assertEq(rToken, pad.POOL_SUPPLY());
        assertApproxEqRel(desk.toUsd(usd, rQuote), TARGET_USD, 1e12, "the pool opens with the curve's backing only");
        assertMarketHolds(coin);
    }

    function test_aDonationSyncedIntoThePair_cannotBeTakenBack() public {
        address coin = launch(alice, usd);
        vm.warp(block.timestamp + 60);
        address pair = pad.pairOf(coin);
        fund(mallory, usd, 5_000e18);
        uint256 gift = TestCurrency(usd).balanceOf(mallory);
        vm.startPrank(mallory);
        TestCurrency(usd).transfer(pair, gift);
        (bool ok,) = pair.call(abi.encodeWithSignature("sync()"));
        vm.stopPrank();
        assertTrue(ok);

        sellOut(coin, bob);

        // The gift stays in the pool (it only raised the opening price), and nobody
        // but the burn address holds any liquidity to take it out with.
        assertEq(IUniswapV2Pair(pair).balanceOf(mallory), 0);
        (, uint256 rQuote) = pairReserves(coin);
        assertApproxEqRel(desk.toUsd(usd, rQuote), TARGET_USD + 5_000e18, 1e12);
        assertMarketHolds(coin);
    }

    function test_aPairCreatedBeforeLaunch_isTheOneUsed() public {
        address next = vm.computeCreateAddress(address(pad), vm.getNonce(address(pad)));
        address early = uniswap.createPair(next, usd);
        address coin = launch(alice, usd);
        assertEq(coin, next);
        assertEq(pad.pairOf(coin), early);
        sellOut(coin, bob);
        assertMarketHolds(coin);
    }

    function test_afterGraduation_thePadAndEveryoneElseTradeTheSamePool() public {
        address coin = launch(alice, jpy);
        vm.warp(block.timestamp + 60);
        sellOut(coin, bob);
        uint256 got = _buyThroughThePad(coin);
        _swapStraightOnUniswap(coin, 5_000_000e18);

        // The pad sees the new price at once.
        (uint256 rToken, uint256 rQuote) = pairReserves(coin);
        Launchpad.Market memory m = pad.getMarket(coin);
        assertEq(m.reserveToken, rToken);
        assertEq(m.reserveQuote, rQuote);
        (uint256 sellQuote,) = pad.quoteSell(coin, got);
        vm.startPrank(carol);
        Coin(coin).approve(address(pad), got);
        uint256 back = pad.sell(coin, got, sellQuote, carol);
        vm.stopPrank();
        assertEq(back, sellQuote, "sell quote matches execution");
        assertEq(pad.snipeTaxNow(coin), 0);
        assertMarketHolds(coin);
        assertCustody(jpy);
    }

    /// Carol buys through the pad: no fee of its own, the pool's price.
    function _buyThroughThePad(address coin) internal returns (uint256 got) {
        fund(carol, jpy, 1_000e18);
        uint256 spend = TestCurrency(jpy).balanceOf(carol);
        (uint256 quoted, uint256 used, uint256 lpFee, uint256 snipe) = pad.quoteBuy(coin, spend);
        assertEq(used, spend);
        assertEq(snipe, 0);
        assertEq(lpFee, spend * 3 / 1000);
        uint256 treasuryOwed = pad.feesOwed(treasury, jpy);
        vm.prank(carol);
        (got,) = pad.buy(coin, spend, quoted, carol);
        assertEq(got, quoted, "quote matches execution");
        assertEq(pad.feesOwed(treasury, jpy), treasuryOwed, "no pad fee in the pool");
    }

    /// Bob sells straight into the pair, the way an aggregator trades it.
    function _swapStraightOnUniswap(address coin, uint256 coinsIn) internal {
        address pair = pad.pairOf(coin);
        (uint256 rToken, uint256 rQuote) = pairReserves(coin);
        uint256 out = coinsIn * 997 * rQuote / (rToken * 1000 + coinsIn * 997);
        vm.startPrank(bob);
        Coin(coin).transfer(pair, coinsIn);
        if (coin < pad.currencyOf(coin)) IUniswapV2Pair(pair).swap(0, out, bob, "");
        else IUniswapV2Pair(pair).swap(out, 0, bob, "");
        vm.stopPrank();
    }

    function test_router_swapsIntoAndOutOfAGraduatedCoin_acrossCurrencies() public {
        address coin = launch(alice, usd);
        vm.warp(block.timestamp + 60);
        sellOut(coin, bob);

        fund(carol, eur, 2_000e18);
        uint256 amount = TestCurrency(eur).balanceOf(carol);
        (uint256 quoted, uint256 quotedRefund) = router.quote(eur, coin, amount);
        assertEq(quotedRefund, 0);
        vm.prank(carol);
        (uint256 got, uint256 refund) = router.swap(eur, coin, amount, quoted, carol, block.timestamp);
        assertEq(got, quoted);
        assertEq(refund, 0);

        vm.startPrank(carol);
        Coin(coin).approve(address(router), got);
        (uint256 back,) = router.quote(coin, jpy, got);
        (uint256 out,) = router.swap(coin, jpy, got, back, carol, block.timestamp);
        vm.stopPrank();
        assertEq(out, back);
        assertEq(Coin(coin).balanceOf(address(router)), 0);
        assertMarketHolds(coin);
    }

    function testFuzz_poolTradesThroughThePad_matchTheirQuotes(uint256 spendUsd, uint256 sellPart) public {
        address coin = launch(alice, kwd);
        vm.warp(block.timestamp + 60);
        sellOut(coin, bob);
        spendUsd = bound(spendUsd, 1e18, 50_000e18);
        sellPart = bound(sellPart, 1, 100);
        fund(carol, kwd, spendUsd);
        uint256 spend = TestCurrency(kwd).balanceOf(carol);
        (uint256 quoted,,,) = pad.quoteBuy(coin, spend);
        vm.prank(carol);
        (uint256 got,) = pad.buy(coin, spend, 0, carol);
        assertEq(got, quoted);
        uint256 selling = got * sellPart / 100;
        if (selling == 0) return;
        (uint256 sellQuote,) = pad.quoteSell(coin, selling);
        vm.startPrank(carol);
        Coin(coin).approve(address(pad), selling);
        uint256 back = pad.sell(coin, selling, 0, carol);
        vm.stopPrank();
        assertEq(back, sellQuote);
        // A round trip through the pool never pays out more than went in.
        if (sellPart == 100) assertLe(back, spend);
        assertMarketHolds(coin);
    }
}
