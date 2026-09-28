// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {Coin} from "../src/Coin.sol";
import {TestCurrency} from "../src/TestCurrency.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {IUniswapV3Pool, IUniswapV3SwapCallback} from "../src/interfaces/IUniswapV3.sol";

/// Someone trading straight on the pool, the way a terminal does.
contract Outsider is IUniswapV3SwapCallback {
    address pool;

    function buy(address pool_, address currency, uint256 amountIn) external returns (uint256 out) {
        pool = pool_;
        (int256 a0,) = IUniswapV3Pool(pool_).swap(
            address(this), false, int256(amountIn), 1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_341, abi.encode(currency)
        );
        out = uint256(-a0);
    }

    function uniswapV3SwapCallback(int256, int256 amount1Delta, bytes calldata data) external {
        require(msg.sender == pool, "pool");
        address currency = abi.decode(data, (address));
        TestCurrency(currency).transfer(msg.sender, uint256(amount1Delta));
    }
}

contract LaunchpadTest is Base {
    function test_launch_opensAPoolWithTheWholeSupplyLocked() public {
        address coin = launch(alice, eur);
        Launchpad.Market memory m = pad.getMarket(coin);
        assertEq(m.creator, alice);
        assertEq(m.currency, eur);
        assertTrue(coin < eur, "coin is token0");
        assertEq(poolOf(coin).token0(), coin);
        assertEq(poolOf(coin).token1(), eur);
        assertEq(poolOf(coin).fee(), 10_000);
        assertEq(Coin(coin).totalSupply(), pad.TOTAL_SUPPLY());
        assertGt(Coin(coin).balanceOf(m.pool), pad.TOTAL_SUPPLY() - 1e18, "the pool holds the supply");
        assertEq(Coin(coin).launchpad(), address(pad));
        assertMarketHolds(coin);
    }

    function test_launch_startsAtTheStartMarketCap() public {
        address coin = launch(alice, eur);
        // 4,000 USD in EUR at 0.86 = 3,440 EUR for the whole supply; the first tick above adds up to 2%
        uint256 startQuote = desk.fromUsd(eur, START_MCAP_USD);
        (uint256 rToken, uint256 rQuote) = pad.reserves(coin);
        uint256 mcap = rQuote * pad.TOTAL_SUPPLY() / rToken;
        assertApproxEqRel(mcap, startQuote, 0.025e18, "market cap at launch");
        assertApproxEqRel(rToken, pad.TOTAL_SUPPLY(), 0.001e18, "all coins on the curve");
    }

    function test_launch_rejectsASaltThatSortsAbove() public {
        bytes32 salt;
        for (uint256 i; i < 8192; ++i) {
            salt = keccak256(abi.encode("bad", i));
            if (pad.coinAddress(salt) > eur) break;
        }
        vm.prank(alice);
        vm.expectRevert(Launchpad.BadSalt.selector);
        pad.createCoin("Storm", "STORM", "{}", eur, salt, 0, 0);
    }

    function test_launch_rejectsBadNamesAndSymbols() public {
        bytes32 salt = saltFor(eur);
        vm.startPrank(alice);
        vm.expectRevert(Launchpad.BadSymbol.selector);
        pad.createCoin("Storm", "st orm", "{}", eur, salt, 0, 0);
        vm.expectRevert(Launchpad.BadName.selector);
        pad.createCoin("", "STORM", "{}", eur, salt, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(Launchpad.CurrencyNotListed.selector, address(0xBEEF)));
        pad.createCoin("Storm", "STORM", "{}", address(0xBEEF), salt, 0, 0);
        vm.stopPrank();
    }

    function test_launch_withAFirstBuyInTheSameTransaction() public {
        fund(alice, eur, 100e18);
        uint256 quoted = pad.quoteLaunchBuy(eur, desk.fromUsd(eur, 50e18));
        address coin = launchWith(alice, eur, desk.fromUsd(eur, 50e18));
        uint256 got = Coin(coin).balanceOf(alice);
        assertGt(got, 0);
        assertApproxEqRel(got, quoted, 0.03e18, "the launch quote is close");
        assertMarketHolds(coin);
    }

    function test_coin_carriesItsMetadata() public {
        bytes32 salt = saltFor(usd);
        vm.prank(alice);
        (address coin,) = pad.createCoin(
            "Storm", "STORM", "{\"name\":\"Storm\",\"image\":\"data:image/webp;base64,AAAA\"}", usd, salt, 0, 0
        );
        assertEq(Coin(coin).metadata(), "{\"name\":\"Storm\",\"image\":\"data:image/webp;base64,AAAA\"}");
        assertEq(
            Coin(coin).contractURI(),
            "data:application/json;utf8,{\"name\":\"Storm\",\"image\":\"data:image/webp;base64,AAAA\"}"
        );
    }

    function test_buy_thenSell_throughThePad() public {
        address coin = launch(alice, usd);
        fund(bob, usd, 200e18);
        uint256 spend = 100e18;
        (uint256 quotedOut,, uint256 fee,) = pad.quoteBuy(coin, spend);
        vm.prank(bob);
        (uint256 out,) = pad.buy(coin, spend, quotedOut * 99 / 100, bob);
        assertEq(Coin(coin).balanceOf(bob), out);
        assertApproxEqRel(out, quotedOut, 0.005e18, "buy quote within 0.5%");
        assertEq(fee, 1e18, "1% of the input is the pool fee");
        uint256 p1 = price(coin);
        assertGt(p1, 0);

        vm.startPrank(bob);
        Coin(coin).approve(address(pad), out);
        (uint256 quotedQuote,) = pad.quoteSell(coin, out);
        uint256 back = pad.sell(coin, out, quotedQuote * 99 / 100, bob);
        vm.stopPrank();
        assertApproxEqRel(back, quotedQuote, 0.005e18, "sell quote within 0.5%");
        // 1% each way: a round trip costs about 2%
        assertLt(back, spend);
        assertGt(back, spend * 97 / 100);
        assertMarketHolds(coin);
    }

    function test_buy_movesThePriceUpAndSellsMoveItDown() public {
        address coin = launch(alice, usd);
        fund(bob, usd, 5_000e18);
        uint256 p0 = price(coin);
        vm.prank(bob);
        (uint256 out,) = pad.buy(coin, 1_000e18, 0, bob);
        uint256 p1 = price(coin);
        assertGt(p1, p0, "buying lifts the price");
        // 1,000 on a 4,000 curve: price about (5/4)^2 = 1.56x
        assertApproxEqRel(p1, p0 * 156 / 100, 0.03e18);
        vm.startPrank(bob);
        Coin(coin).approve(address(pad), out);
        pad.sell(coin, out, 0, bob);
        vm.stopPrank();
        assertLt(price(coin), p1, "selling lowers it");
    }

    function test_buy_refusesSlippage() public {
        address coin = launch(alice, usd);
        fund(bob, usd, 100e18);
        (uint256 quoted,,,) = pad.quoteBuy(coin, 10e18);
        vm.prank(bob);
        vm.expectRevert(Launchpad.Slippage.selector);
        pad.buy(coin, 10e18, quoted * 2, bob);
    }

    function test_sixDecimalCurrency() public {
        address coin = launch(alice, kwd);
        fund(bob, kwd, 100e18);
        uint256 spend = TestCurrency(kwd).balanceOf(bob);
        vm.prank(bob);
        (uint256 out,) = pad.buy(coin, spend, 0, bob);
        assertGt(out, 0);
        // 100 USD on a 4,000 USD curve buys about 1/41 of the supply
        assertApproxEqRel(out, pad.TOTAL_SUPPLY() * 100 / 4_100, 0.05e18);
        assertMarketHolds(coin);
    }

    function test_fees_goHalfToTheCreatorHalfToTheProtocol() public {
        address coin = launch(alice, usd);
        fund(bob, usd, 1_000e18);
        vm.prank(bob);
        pad.buy(coin, 1_000e18, 0, bob);
        uint256 a0 = TestCurrency(usd).balanceOf(alice);
        uint256 t0 = TestCurrency(usd).balanceOf(treasury);
        (uint256 coinFees, uint256 quoteFees) = pad.collectFees(coin);
        assertEq(coinFees, 0, "a buy pays its fee in currency");
        assertApproxEqAbs(quoteFees, 10e18, 1e12, "1% of 1,000");
        assertEq(TestCurrency(usd).balanceOf(alice) - a0, quoteFees / 2, "creator's half");
        assertEq(TestCurrency(usd).balanceOf(treasury) - t0, quoteFees - quoteFees / 2, "protocol's half");
        Launchpad.Market memory m = pad.getMarket(coin);
        assertEq(m.creatorFees, quoteFees / 2);
        // a sell pays its fee in the coin
        vm.startPrank(bob);
        Coin(coin).approve(address(pad), type(uint256).max);
        pad.sell(coin, Coin(coin).balanceOf(bob), 0, bob);
        vm.stopPrank();
        (coinFees, quoteFees) = pad.collectFees(coin);
        assertGt(coinFees, 0);
        assertEq(quoteFees, 0);
        assertEq(Coin(coin).balanceOf(alice), coinFees / 2);
    }

    function test_tradesMadeStraightOnThePoolPayTheCreatorToo() public {
        address coin = launch(alice, usd);
        Outsider o = new Outsider();
        fund(address(o), usd, 500e18);
        uint256 out = o.buy(pad.poolOf(coin), usd, 500e18);
        assertGt(out, 0, "an outsider can buy on Uniswap");
        assertEq(Coin(coin).balanceOf(address(o)), out);
        (, uint256 quoteFees) = pad.collectFees(coin);
        assertApproxEqAbs(quoteFees, 5e18, 1e12, "1% of the outsider's 500 reached the position");
        assertMarketHolds(coin);
    }

    function test_quotes_matchThePoolAfterAnOutsidersTrade() public {
        address coin = launch(alice, usd);
        Outsider o = new Outsider();
        fund(address(o), usd, 300e18);
        o.buy(pad.poolOf(coin), usd, 300e18);
        fund(bob, usd, 100e18);
        (uint256 quoted,,,) = pad.quoteBuy(coin, 100e18);
        vm.prank(bob);
        (uint256 out,) = pad.buy(coin, 100e18, 0, bob);
        assertApproxEqRel(out, quoted, 0.005e18);
    }

    function test_router_coinToCoinAcrossCurrencies() public {
        address a = launch(alice, usd);
        address b = launch(alice, eur);
        fund(bob, usd, 200e18);
        vm.prank(bob);
        (uint256 got,) = pad.buy(a, 100e18, 0, bob);
        // the desk needs EUR to convert into; test currencies are minted on the spot
        vm.startPrank(bob);
        Coin(a).approve(address(router), got);
        (uint256 out,) = router.swap(a, b, got, 0, bob, block.timestamp + 60);
        vm.stopPrank();
        assertGt(out, 0);
        assertEq(Coin(b).balanceOf(bob), out);
        assertEq(Coin(a).balanceOf(bob), 0);
    }

    function test_views_listTheMarket() public {
        address coin = launch(alice, jpy);
        Launchpad.CoinView[] memory page = pad.getCoins(0, 10);
        assertEq(page.length, 1);
        assertEq(page[0].coin, coin);
        assertEq(page[0].symbol, "STORM");
        assertEq(page[0].currency, jpy);
        assertGt(page[0].reserveToken, 0);
        assertGt(page[0].reserveQuote, 0);
        assertEq(page[0].realQuote, 0, "no currency in the pool before a buy");
        assertEq(pad.coinsCount(), 1);
        assertTrue(pad.isCoin(coin));
        assertFalse(pad.isCoin(address(0xBEEF)));
    }

    function test_admin_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        pad.setStartMcapUsd(1e18);
        vm.prank(owner);
        pad.setStartMcapUsd(8_000e18);
        assertEq(pad.startMcapUsd(), 8_000e18);
        vm.prank(owner);
        vm.expectRevert(Launchpad.BadStart.selector);
        pad.setStartMcapUsd(0);
    }

    function test_callback_refusesAnyoneButThePoolInFlight() public {
        vm.expectRevert(Launchpad.NotPool.selector);
        pad.uniswapV3SwapCallback(1, 1, abi.encode(address(0), address(0)));
    }
}
