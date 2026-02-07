// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/Escrow.sol";

import { LibClone } from "solady/utils/LibClone.sol";

// =========================================================================
// MOCKS
// =========================================================================

contract MockERC20 is IERC20 {
    string public name = "Mock Token";
    string public symbol = "MOCK";
    uint8 public immutable decimals;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 public totalSupply;

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return transferFrom(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        if (from != msg.sender) {
            uint256 allowed = allowance[from][msg.sender];
            if (allowed != type(uint256).max) {
                require(allowed >= amount, "Insufficient allowance");
                allowance[from][msg.sender] = allowed - amount;
            }
        }
        require(balanceOf[from] >= amount, "Insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockAggregatorV3 is AggregatorV3Interface {
    uint8 public decimals;
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId;
    uint80 public answeredInRound;

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    function updateAnswer(int256 _answer) external {
        answer = _answer;
        updatedAt = block.timestamp;
        roundId++;
        answeredInRound = roundId;
    }

    function setRoundData(
        uint80 _roundId,
        int256 _answer,
        uint256 _updatedAt,
        uint80 _answeredInRound
    ) external {
        roundId = _roundId;
        answer = _answer;
        updatedAt = _updatedAt;
        answeredInRound = _answeredInRound;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (roundId, answer, 0, updatedAt, answeredInRound);
    }
}

// =========================================================================
// TEST SUITE
// =========================================================================

contract EscrowTest is Test {
    Escrow public escrowImplementation;
    Escrow public escrow;
    MockERC20 public token0;
    MockERC20 public token1;
    MockAggregatorV3 public feed0;
    MockAggregatorV3 public feed1;

    event Buy(address indexed buyer, uint256 amount1In, uint256 amount0Out);
    event Sell(address indexed seller, uint256 amount0In, uint256 amount1Out);

    address public owner = address(this);
    address public alice = address(0xA);
    address public bob = address(0xB);

    // Default params
    Escrow.Params public params;

    function setUp() public {
        // Deploy mocks with default configuration (ETH/USDC style)
        // Asset0: 18 decimals (e.g., WETH)
        // Asset1: 6 decimals (e.g., USDC)
        token0 = new MockERC20(18);
        token1 = new MockERC20(6);

        // Oracles: Chainlink usually 8 decimals for USD feeds (except AMP/ETH pairs etc, but we stick to USD standard)
        feed0 = new MockAggregatorV3(8); // ETH/USD
        feed1 = new MockAggregatorV3(8); // USDC/USD

        // Initial Oracle Prices
        // ETH = $2000
        feed0.updateAnswer(2000 * 1e8);
        // USDC = $1
        feed1.updateAnswer(1 * 1e8);

        escrowImplementation = new Escrow();

        // Setup default params
        params = Escrow.Params({
            dcaOrdersSize: 3,
            priceDeviationBPS: 100, // 1%
            takeProfitBPS: 0,
            priceMultiplierBPS: 11_000, // +10% increase to delta per step
            dcaOrderSizeMultiplierBPS: 500, // +5% size increase? or just scalar. interpreted as (BPS + val) / BPS implies growth
            baseOrderAmount: 1 ether,
            dcaOrderAmount: 1 ether
        });

        // Mint tokens to users including this contract (as owner)
        token0.mint(owner, 1000 ether);
        token1.mint(alice, 100_000e6);
        token1.mint(bob, 100_000e6);
        
        escrow = _createEscrowClone();
    }

    function _createEscrowClone() internal returns (Escrow) {
        address cloneAddr = LibClone.clone(address(escrowImplementation));
        
        // Approve
        token0.approve(cloneAddr, type(uint256).max);
        vm.prank(alice);
        token1.approve(cloneAddr, type(uint256).max);
        vm.prank(bob);
        token1.approve(cloneAddr, type(uint256).max);

        return Escrow(cloneAddr);
    }

    // --- 1) initialize() ---

    function test_Initialize_HappyPath() public {
        escrow = _createEscrowClone();
        uint256 startBal = token0.balanceOf(owner);
        uint256 expectedPull = params.baseOrderAmount + params.dcaOrderAmount * 2; // (3 orders total: 1 base, 2 dca roughly if multiplier logic was just sum)
        
        // Actually calc expected pull exactly to match logic:
        // Order 0: base
        // Order 1: dcaOrderAmount
        // Order 2: dcaOrderAmount * (10000 + 500) / 10000 = 1 * 1.05 = 1.05
        // T = 1 + 1 + 1.05 = 3.05 ether
        uint256 expectedForOrders = 1 ether + 1 ether + 1.05 ether;
        
        escrow.initialize(
            params,
            address(token0),
            address(token1),
            address(feed0),
            address(feed1),
            owner
        );

        // State checks
        assertEq(address(escrow.asset0()), address(token0));
        assertEq(address(escrow.asset1()), address(token1));
        assertEq(escrow.owner(), owner);
        assertEq(escrow.lastExecuteOrder(), 0);
        
        // Balance check
        assertEq(token0.balanceOf(address(escrow)), expectedForOrders);
        assertEq(token0.balanceOf(owner), startBal - expectedForOrders);

        // Orders check
        // Price should be asset1 per asset0
        // Price = 2000e8 / 1e8 = 2000e8 (scaled 1e8)
        // Check order 0
        (uint128 amt, uint128 filled, uint128 price) = escrow.sellOrders(0);
        assertEq(amt, 1 ether);
        assertEq(filled, 0);
        assertEq(price, 2000e8);
    }

    function test_Initialize_Revert_AlreadyInitialized() public {
        escrow = _createEscrowClone();
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);
        vm.expectRevert(bytes4(hex"f92ee8a9")); // InvalidInitialization()
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);
    }

    function test_Initialize_Revert_ZeroAsset() public {
        escrow = _createEscrowClone();
        vm.expectRevert("Zero asset");
        escrow.initialize(params, address(0), address(token1), address(feed0), address(feed1), owner);
    }

    function test_Initialize_Revert_SameAsset() public {
        escrow = _createEscrowClone();

        vm.expectRevert("Same asset");
        escrow.initialize(params, address(token0), address(token0), address(feed0), address(feed1), owner);
    }

    function test_Initialize_Revert_DcaOrdersSizeZero() public {
        escrow = _createEscrowClone();

        params.dcaOrdersSize = 0;
        vm.expectRevert();
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);

        params.dcaOrdersSize = 1;
        vm.expectRevert();
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);
    }

    function test_Initialize_Revert_OracleStale() public {
        escrow = _createEscrowClone();

        // Set oracle update time to 0 or very old but checked via latestRoundData
        // Contract checks: answeredInRound >= roundId
        // Let's make roundId > answeredInRound
        feed0.setRoundData(2, 2000e8, block.timestamp, 1);
        
        vm.expectRevert("oracle stale");
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);
    }

    function test_Initialize_Revert_OracleNoUpdate() public {
        escrow = _createEscrowClone();

        feed0.setRoundData(1, 2000e8, 0, 1);
        vm.expectRevert("oracle no update");
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);
    }

    function test_Initialize_Revert_Asset0TransferFailed() public {
        escrow = _createEscrowClone();

        // Make owner poor or revoke approval
        token0.approve(address(escrow), 0);
        vm.expectRevert("Insufficient allowance"); // MockERC20 message
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);
    }

    // --- 2) Oracle Normalization ---

    function test_OracleNormalization_MixedDecimals() public {
        escrow = _createEscrowClone();

        // Case: Oracle0 has 18 decimals, Oracle1 has 8
        // Asset0 Price $2000, Asset1 Price $1
        // Expect cross rate $2000 scaled to 1e8
        MockAggregatorV3 f0 = new MockAggregatorV3(18);
        f0.updateAnswer(2000 * 1e18);
        
        MockAggregatorV3 f1 = feed1; // 8 decimals, 1e8 ($1)
        
        Escrow e = _createEscrowClone();
        // Just checking initialization logic where it calls _spotPrice...
        // We can't access internal _spotPrice directly but we can inspect the stored order price
        // initial order price = spot price * 1 (effectively, before deviation applied?)
        // Ah, `_previewOrdersIncreasing`:
        // base price = startPrice (no deviation applied to 0th order? Let's check logic)
        // logic: delta = price * BPS... price = startPrice. orders[0] = {..., price: price}
        // So yes, order[0].price == startPrice
        
        // We need token balances for e to initialize
        token0.approve(address(e), type(uint256).max);
        
        e.initialize(params, address(token0), address(token1), address(f0), address(f1), owner);
        
        (,, uint128 price) = e.sellOrders(0);
        assertEq(price, 2000e8);
    }
    
    // --- 3) buy() ---

    function test_Buy_PartialFill() public {
        escrow = _createEscrowClone();

        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);

        // Order 0: 1 ETH @ 2000 USDC
        // Buy 0.5 ETH worth => need 1000 USDC
        uint256 amount1In = 1000e6;
        
        // Alice buys
        vm.prank(alice);
        escrow.buy(amount1In, 0, block.timestamp + 1000);

        // Check balances
        // Alice spent 1000 USDC, got 0.5 ETH
        assertEq(token1.balanceOf(alice), 100_000e6 - 1000e6);
        assertEq(token0.balanceOf(alice), 0.5 ether);
        
        // Check order state
        (uint128 amt, uint128 filled, ) = escrow.sellOrders(0);
        assertEq(amt, 1 ether);
        assertEq(filled, 0.5 ether);
        assertEq(escrow.lastExecuteOrder(), 0);
    }

    function test_Buy_ExactFill() public {
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);

        // Order 0: 1 ETH @ 2000 USDC
        // Buy exactly 1 ETH => need 2000 USDC
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit Buy(alice, 2000e6, 1 ether);
        escrow.buy(2000e6, 0, block.timestamp + 1000);

        (uint128 amt, uint128 filled, ) = escrow.sellOrders(0);
        assertEq(filled, amt);
        assertEq(escrow.lastExecuteOrder(), 1);
    }

    function test_Buy_MultiFill() public {
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);
        
        // Order 0: 1 ETH @ 2000
        // Order 1: 1 ETH @ 2000 + delta
        //   delta = 2000 * 1% = 20. 
        //   delta updated = 20 * 11000/10000 = 22.
        //   Price1 = 2000 + 22 = 2022.
        
        // We want to buy 1.5 ETH.
        // Cost = 2000 (for 1st) + 2022/2 (for 2nd 0.5) = 2000 + 1011 = 3011 USDC
        
        vm.prank(alice);
        escrow.buy(3011e6, 0, block.timestamp + 1000);
        
        // Check orders
        (, uint128 filled0, ) = escrow.sellOrders(0);
        (, uint128 filled1, ) = escrow.sellOrders(1);
        
        assertEq(filled0, 1 ether);
        assertEq(filled1, 0.5 ether);
        assertEq(escrow.lastExecuteOrder(), 1); 
    }

    function test_Buy_Refund() public {
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);
        
        // Send way too much USDC. 
        // Total inventory ~3.05 ETH. Max cost approx 3.05 * ~2100 ~ 6400 USDC.
        // Send 10,000 USDC.
        
        uint256 startBal = token1.balanceOf(alice);
        vm.prank(alice);
        escrow.buy(10_000e6, 0, block.timestamp + 1000);
        
        uint256 spent = startBal - token1.balanceOf(alice);
        assertTrue(spent < 10_000e6);
        assertTrue(spent > 6000e6); // At least consumed orders
    }
    
    function test_Buy_Slippage() public {
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);
        // Expect 0.5 ETH for 1000 USDC
        // Ask for 0.6 ETH
        vm.expectRevert("Slippage");
        vm.prank(alice);
        escrow.buy(1000e6, 0.6 ether, block.timestamp + 1000);
    }

    // --- 4) sell() ---

    function test_Sell_CalculatesRebuyCorrectly() public {
        // First we need to drain some asset0 so there's room to "rebuy"?
        // Wait, 'sell' is USER selling asset0 back to escrow.
        // Escrow pays asset1.
        // Condition: "No sell filled yet" -> implies we must have sold some asset0 via buy() first?
        // Ah, `_totalSoldAsset0()` checks `sellOrders[i].filled`.
        // So yes, someone must have BOUGHT from the escrow first.
        
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);

        // Alice buys 1 ETH (Order 0 filled)
        vm.prank(alice);
        escrow.buy(2000e6, 0, block.timestamp + 1000);
        
        // Now escrow has 2000 USDC and 0 filled on order 0.
        // Wait, Alice bought -> order0.filled = 1 ether.
        // Escrow has 2000 USDC.
        
        // Bob wants to Sell 0.5 ETH back to Escrow.
        // Escrow should rebuy it.
        // Price logic:
        // avgSell = 2000e8
        // start = 2000 * (10000 - 100) / 10000 = 2000 * 0.99 = 1980
        // delta = 1980 * 100 / 10000 = 19.8
        // price = 1980
        
        // Bob sells 0.5 ETH
        // Should get 0.5 * 1980 = 990 USDC
        
        // Bob approves
        token0.mint(bob, 1 ether);
        vm.prank(bob);
        token0.approve(address(escrow), type(uint256).max);
        
        uint256 bobBal0 = token0.balanceOf(bob);
        uint256 bobBal1 = token1.balanceOf(bob);
        
        vm.prank(bob);
        vm.expectEmit(true, false, false, true);
        emit Sell(bob, 0.5 ether, 990e6); // 990 USDC
        escrow.sell(0.5 ether, 0, block.timestamp + 1000);
        
        // Check bob balances
        assertEq(token0.balanceOf(bob), bobBal0 - 0.5 ether);
        assertEq(token1.balanceOf(bob), bobBal1 + 990e6); // 990 USDC
        
        // Check Reset happened
        // If reset, sellOrders are refreshed from Oracle price.
        // Oracle is still 2000.
        // Order 0 should be clean (filled=0).
        (, uint128 filled, ) = escrow.sellOrders(0);
        assertEq(filled, 0);
        assertEq(escrow.lastExecuteOrder(), 0);
    }
    
    function test_Sell_PriceUnderflow_Revert() public {
        // Setup params to force aggressive price drops
        Escrow.Params memory badParams = params;
        badParams.priceDeviationBPS = 5000; // 50% drop start
        badParams.priceMultiplierBPS = 20000; // Double delta each time
        
        Escrow pEscrow = _createEscrowClone();
        token0.mint(address(pEscrow), 100 ether); 
        token0.approve(address(pEscrow), type(uint256).max);
        
        pEscrow.initialize(badParams, address(token0), address(token1), address(feed0), address(feed1), owner);
        
        // Alice setup
        token1.mint(alice, 100_000e6);
        token0.mint(alice, 100 ether); // Enable her to sell large amount
        
        vm.startPrank(alice);
        token1.approve(address(pEscrow), type(uint256).max);
        token0.approve(address(pEscrow), type(uint256).max);

        // Buy fully to have deeply filled ladder
        // Need to fill multiple orders so sell() iterates
        // 10,000 USDC should fill plenty
        pEscrow.buy(10_000e6, 0, block.timestamp + 1000);
        
        // Now sell back - expect underflow 
        vm.expectRevert("price underflow");
        pEscrow.sell(100 ether, 0, block.timestamp + 1000); 
        
        vm.stopPrank();
    }

    function test_Sell_InventoryCapped() public {
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);

        // 1. Buy EVERYTHING (drain asset0)
        vm.prank(alice);
        escrow.buy(10_000e6, 0, block.timestamp + 1000); // should clear it out
        
        assertEq(token0.balanceOf(address(escrow)), 0);

        // 2. Sell back a TINY amount (e.g. 0.0001 ETH)
        // This puts 0.0001 ETH into escrow.
        // Triggers reset.
        // New ladder should be capped to 0.0001 ETH inventory.
        
        vm.prank(alice);
        token0.approve(address(escrow), type(uint256).max);
        escrow.sell(0.0001 ether, 0, block.timestamp + 1000);

        // Check Orders
        // Order 0 should have amount 0.0001 (or less if baseOrder is smaller? base is 1 ether).
        // So Order 0 amount should be capped to 0.0001.
        (uint128 amt0, uint128 filled0, ) = escrow.sellOrders(0);
        assertEq(amt0, 0.0001 ether);
        assertEq(filled0, 0); // reset
        
        // Order 1 should be 0
        (uint128 amt1, , ) = escrow.sellOrders(1);
        assertEq(amt1, 0);
    }
    
    // --- 5) Invariants / Fuzz ---
    
    function testFuzz_Buy_Sell_RoundTrip(uint256 buyAmount1) public {
        // Bound buy amount to reasonable limits (1 USDC to 1M USDC)
        buyAmount1 = bound(buyAmount1, 1e6, 1_000_000e6);
        
        escrow.initialize(params, address(token0), address(token1), address(feed0), address(feed1), owner);
        
        // Alice Buys
        token1.mint(alice, buyAmount1);
        vm.startPrank(alice);
        token1.approve(address(escrow), buyAmount1);
        
        // If buy amount is too small to buy anything, we expect transfer but maybe 0 out?
        // Or if slippage 0 ok.
        escrow.buy(buyAmount1, 0, block.timestamp + 1000);
        
        uint256 bought0 = token0.balanceOf(alice);
        
        if (bought0 > 0) {
            // Sell it back immediately
            token0.approve(address(escrow), bought0);
            escrow.sell(bought0, 0, block.timestamp + 1000);
            
            // Invariants
            // 1. Escrow solvency: asset0 balance + sold amounts? 
            // 2. Orders reset (filled == 0)
            ( , uint128 filled, ) = escrow.sellOrders(0);
            assertEq(filled, 0);
        }
        vm.stopPrank();
    }
}
