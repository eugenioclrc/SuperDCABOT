// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract Escrow {
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
    ) public  {
      
    }


    // --- users buy asset0 paying asset1 ---
    function buy(uint256 amount1In, uint256 minAmount0Out, uint256 deadline) external nonReentrant {
       
    }

    // --- users sell asset0 back (rebuy step) + reset on any fill ---
    function sell(uint256 amount0In, uint256 minAmount1Out, uint256 deadline) external nonReentrant {
       
    }

}
