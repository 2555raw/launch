// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {Coin} from "../src/Coin.sol";
import {TestCurrency} from "../src/TestCurrency.sol";
import {CurrencyDesk} from "../src/CurrencyDesk.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {Router} from "../src/Router.sol";

contract RouterDeskTest is Base {
    function test_desk_convertsAtTheRates_lessTheFee() public {
        fund(alice, usd, 100e18);
        vm.startPrank(alice);
        TestCurrency(usd).approve(address(desk), type(uint256).max);
        uint256 out = desk.convert(usd, eur, 100e18, 0, alice);
        vm.stopPrank();
        // 100 USD -> 86 EUR, less 0.10%.
        assertEq(out, 86e18 * 9990 / 10_000);
        assertEq(TestCurrency(eur).balanceOf(alice), out);
        assertEq(TestCurrency(usd).balanceOf(alice), 0);
    }

    function test_desk_handlesDifferentDecimals() public {
        fund(alice, eur, 1_000e18);
        uint256 amount = TestCurrency(eur).balanceOf(alice);
        (uint256 out,) = desk.quoteConvert(eur, kwd, amount);
        // 1000 USD of EUR is 305 KWD in 6 decimals, less the fee.
        assertApproxEqRel(out, 305e6 * 9990 / 10_000, 1e12);
        assertApproxEqRel(desk.toUsd(kwd, 305e6), 1_000e18, 1e12);
    }

    function test_desk_faucetRespectsCooldown() public {
        vm.prank(alice);
        uint256 got = desk.faucet(jpy);
        assertEq(got, 148_000e18);
        assertEq(TestCurrency(jpy).balanceOf(alice), got);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CurrencyDesk.FaucetCooldown.selector, block.timestamp + 1 hours));
        desk.faucet(jpy);
        // Other currencies have their own clock.
        vm.prank(alice);
        desk.faucet(eur);
        vm.warp(block.timestamp + 1 hours);
        vm.prank(alice);
        desk.faucet(jpy);
    }

    function test_desk_keeperMovesAreBounded() public {
        address keeper = makeAddr("keeper");
        vm.prank(owner);
        desk.setKeeper(keeper, true);

        address[] memory tokens = new address[](1);
        uint256[] memory rates = new uint256[](1);
        tokens[0] = eur;
        rates[0] = 0.9e18;
        vm.prank(keeper);
        desk.setRates(tokens, rates);
        assertEq(desk.rateOf(eur), 0.9e18);

        rates[0] = 1.2e18; // +33%
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(CurrencyDesk.RateMoveTooLarge.selector, eur, 0.9e18, 1.2e18));
        desk.setRates(tokens, rates);

        vm.prank(alice);
        vm.expectRevert(CurrencyDesk.NotKeeper.selector);
        desk.setRates(tokens, rates);

        vm.prank(owner);
        desk.forceRate(eur, 1.2e18);
        assertEq(desk.rateOf(eur), 1.2e18);
    }

    function test_desk_listsExternalTokensWithoutMinting() public {
        TestCurrency ext = TestCurrency(address(new ExternalStable()));
        vm.prank(owner);
        desk.listCurrency(address(ext), "USDC", 1e18);
        CurrencyDesk.Currency memory c = desk.getCurrency(address(ext));
        assertFalse(c.mintable);
        assertEq(c.decimals, 6);
        vm.expectRevert(abi.encodeWithSelector(CurrencyDesk.NotMintable.selector, address(ext)));
        desk.faucet(address(ext));
        address other = address(new ExternalStable());
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(CurrencyDesk.CodeTaken.selector, "USD"));
        desk.listCurrency(other, "USD", 1e18);
    }

    function test_router_currencyToCoin_acrossCurrencies() public {
        address coin = launch(alice, eur);
        vm.warp(block.timestamp + 60);
        fund(bob, jpy, 200e18);
        uint256 amount = TestCurrency(jpy).balanceOf(bob);

        (uint256 quoted,) = router.quote(jpy, coin, amount);
        vm.prank(bob);
        (uint256 got, uint256 refund) = router.swap(jpy, coin, amount, quoted, bob, block.timestamp);
        assertEq(got, quoted);
        assertEq(refund, 0);
        assertEq(Coin(coin).balanceOf(bob), got);
        assertEq(TestCurrency(jpy).balanceOf(bob), 0);
        assertMarketHolds(coin);
        assertCustody(eur);
        _routerHoldsNothing(coin);
    }

    function test_router_coinToCoin_acrossCurrencies() public {
        address a = launch(alice, eur);
        address b = launch(carol, vnd);
        vm.warp(block.timestamp + 60);
        fund(bob, eur, 300e18);
        uint256 spend = TestCurrency(eur).balanceOf(bob);
        vm.prank(bob);
        (uint256 gotA,) = pad.buy(a, spend, 0, bob);

        vm.startPrank(bob);
        Coin(a).approve(address(router), gotA);
        (uint256 quoted,) = router.quote(a, b, gotA);
        vm.recordLogs();
        (uint256 gotB,) = router.swap(a, b, gotA, quoted, bob, block.timestamp);
        vm.stopPrank();

        assertEq(gotB, quoted);
        assertEq(Coin(b).balanceOf(bob), gotB);
        assertEq(Coin(a).balanceOf(bob), 0);
        assertMarketHolds(a);
        assertMarketHolds(b);
        assertCustody(eur);
        assertCustody(vnd);
        _routerHoldsNothing(a);
        _routerHoldsNothing(b);

        // Both fills are attributed to bob, not to the router.
        uint256 trades;
        bytes32 tradeTopic = Launchpad.Trade.selector;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == tradeTopic) {
                assertEq(address(uint160(uint256(logs[i].topics[2]))), bob);
                ++trades;
            }
        }
        assertEq(trades, 2);
    }

    function test_router_coinToOtherCurrency() public {
        address coin = launch(alice, eur);
        vm.warp(block.timestamp + 60);
        fund(bob, eur, 100e18);
        uint256 spend = TestCurrency(eur).balanceOf(bob);
        vm.prank(bob);
        (uint256 got,) = pad.buy(coin, spend, 0, bob);
        vm.startPrank(bob);
        Coin(coin).approve(address(router), got);
        (uint256 quoted,) = router.quote(coin, usd, got);
        (uint256 out,) = router.swap(coin, usd, got, quoted, bob, block.timestamp);
        vm.stopPrank();
        assertEq(out, quoted);
        assertEq(TestCurrency(usd).balanceOf(bob), out);
        assertApproxEqRel(out, 98e18, 0.01e18); // two 1% fees and the desk fee
        _routerHoldsNothing(coin);
    }

    function test_router_refundsWhatAGraduatingBuyDidNotNeed() public {
        address coin = launch(alice, usd);
        vm.warp(block.timestamp + 60);
        fund(bob, jpy, 100_000e18);
        uint256 amount = TestCurrency(jpy).balanceOf(bob);
        (uint256 quoted, uint256 quotedRefund) = router.quote(jpy, coin, amount);
        vm.prank(bob);
        (uint256 got, uint256 refund) = router.swap(jpy, coin, amount, quoted, bob, block.timestamp);
        assertEq(got, pad.CURVE_SUPPLY());
        assertEq(refund, quotedRefund);
        assertGt(refund, 0);
        // The refund comes back in the coin's currency.
        assertEq(TestCurrency(usd).balanceOf(bob), refund);
        assertTrue(pad.getMarket(coin).graduated);
        _routerHoldsNothing(coin);
    }

    function test_router_rejectsUnknownTokens_andExpiredDeadlines() public {
        address coin = launch(alice, usd);
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(Router.UnknownToken.selector, address(0xbad)));
        router.swap(address(0xbad), coin, 1, 0, bob, block.timestamp);
        vm.expectRevert(Router.Expired.selector);
        router.swap(usd, coin, 1, 0, bob, block.timestamp - 1);
        vm.expectRevert(Router.SameToken.selector);
        router.swap(usd, usd, 1, 0, bob, block.timestamp);
        vm.stopPrank();
    }

    function test_router_lens() public {
        fund(bob, usd, 10e18);
        address[] memory tokens = new address[](2);
        tokens[0] = usd;
        tokens[1] = eur;
        uint256[] memory b = router.balancesOf(bob, tokens);
        assertEq(b[0], 10e18);
        assertEq(b[1], 0);
        uint256[] memory a = router.allowancesOf(bob, address(router), tokens);
        assertEq(a[0], type(uint256).max);
    }

    function _routerHoldsNothing(address coin) internal view {
        assertEq(Coin(coin).balanceOf(address(router)), 0, "router holds coins");
        assertEq(TestCurrency(usd).balanceOf(address(router)), 0, "router holds USD");
        assertEq(TestCurrency(eur).balanceOf(address(router)), 0, "router holds EUR");
        assertEq(TestCurrency(jpy).balanceOf(address(router)), 0, "router holds JPY");
        assertEq(TestCurrency(vnd).balanceOf(address(router)), 0, "router holds VND");
    }
}

import {Vm} from "forge-std/Vm.sol";
import {ERC20} from "solady/tokens/ERC20.sol";

contract ExternalStable is ERC20 {
    function name() public pure override returns (string memory) {
        return "External USD";
    }

    function symbol() public pure override returns (string memory) {
        return "XUSD";
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
