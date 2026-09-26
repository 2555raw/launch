// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Base} from "./Base.t.sol";
import {Coin} from "../src/Coin.sol";
import {TestCurrency} from "../src/TestCurrency.sol";
import {CurrencyDesk} from "../src/CurrencyDesk.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {Router} from "../src/Router.sol";

/// Random traders launching, buying, selling and routing across currencies.
contract Handler is Test {
    Launchpad pad;
    Router router;
    CurrencyDesk desk;
    address[] currencies;
    address[] traders;
    address[] public coins;

    constructor(Launchpad pad_, Router router_, address[] memory currencies_) {
        pad = pad_;
        router = router_;
        desk = pad_.desk();
        currencies = currencies_;
        for (uint256 i; i < 4; ++i) {
            address t = address(uint160(0x7000 + i));
            traders.push(t);
            vm.startPrank(t);
            for (uint256 j; j < currencies.length; ++j) {
                TestCurrency(currencies[j]).approve(address(pad), type(uint256).max);
                TestCurrency(currencies[j]).approve(address(router), type(uint256).max);
            }
            vm.stopPrank();
        }
    }

    function coinCount() external view returns (uint256) {
        return coins.length;
    }

    function _fund(address to, address token, uint256 usd) internal {
        uint256 amount = desk.fromUsd(token, usd);
        vm.prank(address(desk));
        TestCurrency(token).mint(to, amount);
    }

    function launch(uint256 who, uint256 cur, uint256 firstBuyUsd) external {
        address t = traders[who % traders.length];
        address c = currencies[cur % currencies.length];
        firstBuyUsd = bound(firstBuyUsd, 0, 3_000e18);
        uint256 firstBuy;
        if (firstBuyUsd != 0) {
            _fund(t, c, firstBuyUsd);
            firstBuy = desk.fromUsd(c, firstBuyUsd);
        }
        vm.prank(t);
        (address coin,) = pad.createCoin("Invariant", "INV", "", c, firstBuy, 0);
        coins.push(coin);
    }

    function buy(uint256 who, uint256 coinIdx, uint256 usd, uint256 wait) external {
        if (coins.length == 0) return;
        address t = traders[who % traders.length];
        address coin = coins[coinIdx % coins.length];
        address c = pad.currencyOf(coin);
        usd = bound(usd, 1e15, 8_000e18);
        vm.warp(block.timestamp + bound(wait, 0, 20));
        _fund(t, c, usd);
        uint256 amount = desk.fromUsd(c, usd);
        vm.prank(t);
        pad.buy(coin, amount, 0, t);
    }

    function sell(uint256 who, uint256 coinIdx, uint256 part) external {
        if (coins.length == 0) return;
        address t = traders[who % traders.length];
        address coin = coins[coinIdx % coins.length];
        uint256 bal = Coin(coin).balanceOf(t);
        uint256 amount = bal * bound(part, 1, 100) / 100;
        if (amount == 0) return;
        vm.startPrank(t);
        Coin(coin).approve(address(pad), amount);
        pad.sell(coin, amount, 0, t);
        vm.stopPrank();
    }

    function swap(uint256 who, uint256 fromIdx, uint256 toIdx, uint256 part, uint256 usd) external {
        if (coins.length == 0) return;
        address t = traders[who % traders.length];
        // Indexes past the coin list pick a currency instead.
        uint256 span = coins.length + currencies.length;
        address tokenIn = _tokenAt(fromIdx % span);
        address tokenOut = _tokenAt(toIdx % span);
        if (tokenIn == tokenOut) return;
        uint256 amount;
        if (pad.isCoin(tokenIn)) {
            amount = Coin(tokenIn).balanceOf(t) * bound(part, 1, 100) / 100;
            if (amount == 0) return;
            vm.prank(t);
            Coin(tokenIn).approve(address(router), amount);
        } else {
            usd = bound(usd, 1e15, 5_000e18);
            _fund(t, tokenIn, usd);
            amount = desk.fromUsd(tokenIn, usd);
        }
        vm.prank(t);
        router.swap(tokenIn, tokenOut, amount, 0, t, block.timestamp);
    }

    function claim(uint256 who, uint256 cur) external {
        address t = traders[who % traders.length];
        address c = currencies[cur % currencies.length];
        if (pad.feesOwed(t, c) == 0) return;
        vm.prank(t);
        pad.claimFees(c);
    }

    function _tokenAt(uint256 i) internal view returns (address) {
        return i < coins.length ? coins[i] : currencies[i - coins.length];
    }
}

contract InvariantsTest is Base {
    Handler handler;
    address[] curList;

    function setUp() public override {
        super.setUp();
        curList.push(usd);
        curList.push(eur);
        curList.push(jpy);
        curList.push(kwd);
        curList.push(vnd);
        handler = new Handler(pad, router, curList);
        targetContract(address(handler));
    }

    function invariant_everyMarketIsBacked() public view {
        for (uint256 i; i < handler.coinCount(); ++i) {
            assertMarketHolds(handler.coins(i));
        }
    }

    function invariant_backingSumsPerCurrency() public view {
        uint256 n = handler.coinCount();
        for (uint256 j; j < curList.length; ++j) {
            uint256 sum;
            for (uint256 i; i < n; ++i) {
                Launchpad.Market memory m = pad.getMarket(handler.coins(i));
                if (m.currency == curList[j]) sum += m.realQuote;
            }
            assertEq(sum, pad.backing(curList[j]), "backing total");
            assertCustody(curList[j]);
        }
    }

    function invariant_routerHoldsNothing() public view {
        for (uint256 j; j < curList.length; ++j) {
            assertEq(TestCurrency(curList[j]).balanceOf(address(router)), 0);
        }
        for (uint256 i; i < handler.coinCount(); ++i) {
            assertEq(Coin(handler.coins(i)).balanceOf(address(router)), 0);
        }
    }
}
