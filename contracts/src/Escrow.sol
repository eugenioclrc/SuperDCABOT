// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {Initializable} from "solady/utils/Initializable.sol";
import {AggregatorV3Interface} from "./IChainlinkAggregator.sol";

contract Escrow is Ownable, ReentrancyGuard, Initializable {
    address public asset0; // escrow sells asset0
    address public asset1; // escrow receives/pays asset1

    uint256 public asset0DecimalsFactor;
    uint256 public asset1DecimalsFactor;

    // USD feeds for cross-rate
    address public oracleAsset0Usd;
    address public oracleAsset1Usd;
    uint8 public oracle0Decimals;
    uint8 public oracle1Decimals;

    uint256 public constant BPS = 10_000;
    uint256 public constant PRICE_SCALE = 1e8; // internal price scale (asset1 per 1 asset0)

    event Buy(address indexed buyer, uint256 amount1In, uint256 amount0Out);
    event Sell(address indexed seller, uint256 amount0In, uint256 amount1Out);

    Params public params;

    SellOrder[] public sellOrders; // increasing prices
    uint256 public lastExecuteOrder; // cursor for buy()

    struct SellOrder {
        uint128 amount; // asset0 qty (smallest units)
        uint128 filled; // asset0 filled (smallest units)
        uint128 price; // asset1 per 1 asset0, scaled 1e8
    }

    struct Params {
        uint256 dcaOrdersSize;
        uint256 priceDeviationBPS;
        uint256 takeProfitBPS;
        uint128 priceMultiplierBPS;
        uint128 dcaOrderSizeMultiplierBPS;
        uint128 baseOrderAmount;
        uint128 dcaOrderAmount;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        Params memory p,
        address _asset0,
        address _asset1,
        address _oracleAsset0Usd,
        address _oracleAsset1Usd,
        address _owner
    ) public initializer {
        require(_asset0 != address(0) && _asset1 != address(0), "Zero asset");
        require(_asset0 != _asset1, "Same asset");
        require(p.dcaOrdersSize > 1, "dcaOrdersSize must be >1");
        require(_oracleAsset0Usd != address(0) && _oracleAsset1Usd != address(0), "Zero oracle");
        require(p.takeProfitBPS < BPS, "takeProfitBPS>=BPS");

        _initializeOwner(_owner);
        params = p;

        asset0 = _asset0;
        asset1 = _asset1;

        asset0DecimalsFactor = 10 ** uint256(IERC20(_asset0).decimals());
        asset1DecimalsFactor = 10 ** uint256(IERC20(_asset1).decimals());

        oracleAsset0Usd = _oracleAsset0Usd;
        oracleAsset1Usd = _oracleAsset1Usd;
        oracle0Decimals = AggregatorV3Interface(_oracleAsset0Usd).decimals();
        oracle1Decimals = AggregatorV3Interface(_oracleAsset1Usd).decimals();

        uint256 startPrice1e8 = _spotPriceAsset0InAsset1_1e8();
        SellOrder[] memory raw = _previewOrdersIncreasing(p, startPrice1e8);

        uint256 need0 = _sumAmounts(raw);
        require(IERC20(asset0).transferFrom(_owner, address(this), need0), "asset0 transferFrom failed");

        sellOrders = raw;
        lastExecuteOrder = 0;
    }

    // --- oracle cross-rate: (asset0/USD) / (asset1/USD) = asset1 per asset0 ---
    function _oracleTo1e8(address feed, uint8 feedDecimals) internal view returns (uint256) {
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) =
            AggregatorV3Interface(feed).latestRoundData();

        require(answer > 0, "oracle<=0");
        require(updatedAt != 0, "oracle no update");
        require(answeredInRound >= roundId, "oracle stale");
        require(block.timestamp - updatedAt < 1 hours, "oracle too old");

        uint256 p = uint256(answer);

        if (feedDecimals == 8) return p;
        if (feedDecimals > 8) return p / (10 ** uint256(feedDecimals - 8));
        return p * (10 ** uint256(8 - feedDecimals));
    }

    function _spotPriceAsset0InAsset1_1e8() internal view returns (uint256) {
        uint256 a0Usd = _oracleTo1e8(oracleAsset0Usd, oracle0Decimals);
        uint256 a1Usd = _oracleTo1e8(oracleAsset1Usd, oracle1Decimals);
        require(a1Usd != 0, "asset1Usd=0");
        return (a0Usd * PRICE_SCALE) / a1Usd; // still 1e8
    }

    // --- quoting (price is asset1 per 1 asset0, scaled 1e8) ---
    function _quoteAsset0Out(uint256 asset1In, uint256 price1e8) internal view returns (uint256) {
        // asset0Out = asset1In * 10^a0 * 1e8 / (price * 10^a1)
        return (asset1In * asset0DecimalsFactor * PRICE_SCALE) / (price1e8 * asset1DecimalsFactor);
    }

    function _quoteAsset1In(uint256 asset0Qty, uint256 price1e8) internal view returns (uint256) {
        // asset1In = asset0Qty * price * 10^a1 / (10^a0 * 1e8) (floor)
        return (asset0Qty * price1e8 * asset1DecimalsFactor) / (asset0DecimalsFactor * PRICE_SCALE);
    }

    function _quoteAsset1InCeil(uint256 asset0Qty, uint256 price1e8) internal view returns (uint256) {
        uint256 num = asset0Qty * price1e8 * asset1DecimalsFactor;
        uint256 den = asset0DecimalsFactor * PRICE_SCALE;
        return (num + den - 1) / den;
    }

    // --- users buy asset0 paying asset1 ---
    function buy(uint256 amount1In, uint256 minAmount0Out, uint256 deadline) external nonReentrant {
        require(block.timestamp < deadline, "Deadline passed");
        require(amount1In > 0, "Amount=0");

        require(IERC20(asset1).transferFrom(msg.sender, address(this), amount1In), "asset1 transferFrom failed");

        uint256 remainingIn = amount1In;
        uint256 totalOut0 = 0;

        uint256 i = lastExecuteOrder;
        while (i < sellOrders.length && remainingIn > 0) {
            SellOrder storage o = sellOrders[i];

            if (o.filled == o.amount) {
                i++;
                continue;
            }

            uint256 remaining0 = uint256(o.amount) - uint256(o.filled);

            uint256 maxFill0 = _quoteAsset0Out(remainingIn, uint256(o.price));
            if (maxFill0 == 0) break;

            uint256 fill0 = maxFill0 >= remaining0 ? remaining0 : maxFill0;

            uint256 need1 = _quoteAsset1InCeil(fill0, uint256(o.price));
            if (need1 == 0) break;

            if (need1 > remainingIn) {
                if (fill0 <= 1) break;
                fill0 -= 1;
                need1 = _quoteAsset1InCeil(fill0, uint256(o.price));
                if (need1 > remainingIn) break;
            }

            remainingIn -= need1;
            totalOut0 += fill0;

            o.filled = uint128(uint256(o.filled) + fill0);

            if (o.filled == o.amount) i++;
            else break;
        }

        lastExecuteOrder = i;

        require(totalOut0 >= minAmount0Out, "Slippage");
        require(IERC20(asset0).transfer(msg.sender, totalOut0), "asset0 transfer failed");

        emit Buy(msg.sender, amount1In - remainingIn, totalOut0);

        if (remainingIn > 0) {
            require(IERC20(asset1).transfer(msg.sender, remainingIn), "asset1 refund failed");
        }
    }

    // --- users sell asset0 back (rebuy step) + reset on any fill ---
    function sell(uint256 amount0In, uint256 minAmount1Out, uint256 deadline) external nonReentrant {
        require(block.timestamp < deadline, "Deadline passed");
        require(amount0In > 0, "Amount=0");
        require(_totalSoldAsset0() > 0, "No sell filled yet");

        require(IERC20(asset0).transferFrom(msg.sender, address(this), amount0In), "asset0 transferFrom failed");

        uint256 remainingIn0 = amount0In;
        uint256 totalOut1 = 0;

        uint256 avgSell = _averageSellPrice1e8();
        require(avgSell > 0, "avgSell=0");

        uint256 start = (avgSell * (BPS - params.takeProfitBPS)) / BPS;
        require(start > 0, "rebuy start=0");

        //uint128 delta = uint128((start * params.priceDeviationBPS) / BPS);
        uint128 delta = uint128((avgSell * params.priceDeviationBPS) / BPS);
        uint128 price = uint128(start);

        require(delta < start, "delta>=start");
        require(price > delta, "price underflow");

        for (uint256 i = 0; i < sellOrders.length && remainingIn0 > 0; i++) {
            uint256 soldStep0 = uint256(sellOrders[i].filled);
            if (soldStep0 != 0) {
                uint256 use0 = remainingIn0 > soldStep0 ? soldStep0 : remainingIn0;

                uint256 out1 = _quoteAsset1In(use0, uint256(price));
                if (out1 == 0) break;

                remainingIn0 -= use0;
                totalOut1 += out1;
            }

            if (i + 1 < sellOrders.length) {
                delta = uint128((uint256(delta) * uint256(params.priceMultiplierBPS)) / BPS);
                require(price > delta, "price underflow");
                price -= delta;
            }
        }

        require(totalOut1 >= minAmount1Out, "Slippage");
        require(IERC20(asset1).transfer(msg.sender, totalOut1), "asset1 transfer failed");

        emit Sell(msg.sender, amount0In - remainingIn0, totalOut1);

        if (remainingIn0 > 0) {
            require(IERC20(asset0).transfer(msg.sender, remainingIn0), "asset0 refund failed");
        }

        if (totalOut1 > 0) {
            _resetToSellingFromOracle();
        }
    }

    function _resetToSellingFromOracle() internal {
        uint256 startPrice1e8 = _spotPriceAsset0InAsset1_1e8();
        SellOrder[] memory raw = _previewOrdersIncreasing(params, startPrice1e8);

        uint256 inventory0 = IERC20(asset0).balanceOf(address(this));
        SellOrder[] memory capped = _capOrdersToInventory(raw, inventory0);

        sellOrders = capped;
        lastExecuteOrder = 0;
    }

    // --- sold tracking / avg ---
    function _totalSoldAsset0() internal view returns (uint256 sold0) {
        for (uint256 i = 0; i < sellOrders.length; i++) {
            sold0 += uint256(sellOrders[i].filled);
        }
    }

    function _averageSellPrice1e8() internal view returns (uint256) {
        uint256 totalFilled0 = 0;
        uint256 totalCost1 = 0;

        for (uint256 i = 0; i < sellOrders.length; i++) {
            uint256 f0 = uint256(sellOrders[i].filled);
            if (f0 == 0) continue;

            totalFilled0 += f0;
            totalCost1 += _quoteAsset1InCeil(f0, uint256(sellOrders[i].price));
        }

        if (totalFilled0 == 0) return 0;

        return (totalCost1 * asset0DecimalsFactor * PRICE_SCALE) / (totalFilled0 * asset1DecimalsFactor);
    }

    // --- order builders ---
    function _previewOrdersIncreasing(Params memory p, uint256 startPrice1e8)
        internal
        pure
        returns (SellOrder[] memory)
    {
        SellOrder[] memory orders = new SellOrder[](p.dcaOrdersSize);

        uint128 delta = uint128((startPrice1e8 * p.priceDeviationBPS) / BPS);
        uint128 price = uint128(startPrice1e8);

        orders[0] = SellOrder({amount: p.baseOrderAmount, filled: 0, price: price});

        uint128 currentOrderSize = p.dcaOrderAmount;
        for (uint256 i = 1; i < p.dcaOrdersSize; i++) {
            delta = uint128((uint256(delta) * uint256(p.priceMultiplierBPS)) / BPS);
            price += delta;

            orders[i] = SellOrder({amount: currentOrderSize, filled: 0, price: price});

            currentOrderSize = uint128((uint256(currentOrderSize) * (BPS + uint256(p.dcaOrderSizeMultiplierBPS))) / BPS);
        }

        return orders;
    }

    function _capOrdersToInventory(SellOrder[] memory raw, uint256 inventory0)
        internal
        pure
        returns (SellOrder[] memory)
    {
        uint256 remaining = inventory0;

        for (uint256 i = 0; i < raw.length; i++) {
            uint256 a = uint256(raw[i].amount);

            if (remaining == 0) {
                raw[i].amount = 0;
                raw[i].filled = 0;
                continue;
            }

            if (a <= remaining) {
                remaining -= a;
            } else {
                raw[i].amount = uint128(remaining);
                raw[i].filled = 0;
                remaining = 0;
            }
        }

        return raw;
    }

    function _sumAmounts(SellOrder[] memory orders) internal pure returns (uint256 t) {
        for (uint256 i = 0; i < orders.length; i++) {
            t += uint256(orders[i].amount);
        }
    }

    // --- PUBLIC VIEW FUNCTIONS FOR FRONTEND ---

    /// @notice Get all sell orders
    /// @return Array of sell orders
    function getSellOrders() external view returns (SellOrder[] memory) {
        return sellOrders;
    }

    /// @notice Get available asset0 liquidity in the escrow
    /// @return Amount of asset0 available
    function getAvailableLiquidity() external view returns (uint256) {
        return IERC20(asset0).balanceOf(address(this));
    }

    /// @notice Get current oracle spot price
    /// @return Price in 1e8 scale (asset1 per asset0)
    function getCurrentSpotPrice() external view returns (uint256) {
        return _spotPriceAsset0InAsset1_1e8();
    }

    /// @notice Estimate buy output for a given asset1 input
    /// @param amount1In Amount of asset1 to spend
    /// @return amount0Out Estimated asset0 output
    /// @return orderIndicesFilled Array of order indices that would be filled
    function estimateBuyOutput(uint256 amount1In)
        external
        view
        returns (uint256 amount0Out, uint256[] memory orderIndicesFilled)
    {
        if (amount1In == 0) {
            return (0, new uint256[](0));
        }

        uint256 remainingIn = amount1In;
        uint256 totalOut0 = 0;
        uint256[] memory tempIndices = new uint256[](sellOrders.length);
        uint256 filledCount = 0;

        uint256 i = lastExecuteOrder;
        while (i < sellOrders.length && remainingIn > 0) {
            SellOrder storage o = sellOrders[i];

            if (o.filled == o.amount) {
                i++;
                continue;
            }

            uint256 remaining0 = uint256(o.amount) - uint256(o.filled);
            uint256 maxFill0 = _quoteAsset0Out(remainingIn, uint256(o.price));
            if (maxFill0 == 0) break;

            uint256 fill0 = maxFill0 >= remaining0 ? remaining0 : maxFill0;
            uint256 need1 = _quoteAsset1InCeil(fill0, uint256(o.price));
            if (need1 == 0) break;

            if (need1 > remainingIn) {
                if (fill0 <= 1) break;
                fill0 -= 1;
                need1 = _quoteAsset1InCeil(fill0, uint256(o.price));
                if (need1 > remainingIn) break;
            }

            remainingIn -= need1;
            totalOut0 += fill0;
            tempIndices[filledCount] = i;
            filledCount++;

            if (uint256(o.filled) + fill0 == uint256(o.amount)) i++;
            else break;
        }

        // Copy to correctly sized array
        orderIndicesFilled = new uint256[](filledCount);
        for (uint256 j = 0; j < filledCount; j++) {
            orderIndicesFilled[j] = tempIndices[j];
        }

        amount0Out = totalOut0;
    }

    /// @notice Get total asset0 sold (filled) across all orders
    /// @return Total filled amount
    function getTotalSoldAsset0() external view returns (uint256) {
        return _totalSoldAsset0();
    }

    /// @notice Get average sell price across filled orders
    /// @return Average price in 1e8 scale
    function getAverageSellPrice() external view returns (uint256) {
        return _averageSellPrice1e8();
    }
}
