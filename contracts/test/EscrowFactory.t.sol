// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/EscrowFactory.sol";
import "../src/Escrow.sol";
import "./Escrow.t.sol"; // Reusing Mocks

contract EscrowFactoryTest is Test {
    event EscrowCreated(address indexed escrow, address indexed owner, address asset0, address asset1);

    EscrowFactory public factory;
    Escrow public implementation;
    MockERC20 public token0;
    MockERC20 public token1;
    MockAggregatorV3 public feed0;
    MockAggregatorV3 public feed1;

    address public alice = address(0xA);

    Escrow.Params public params;

    function setUp() public {
        token0 = new MockERC20(18);
        token1 = new MockERC20(6);
        feed0 = new MockAggregatorV3(8);
        feed1 = new MockAggregatorV3(8);

        feed0.updateAnswer(2000e8);
        feed1.updateAnswer(1e8);

        implementation = new Escrow();
        factory = new EscrowFactory(address(implementation));

        params = Escrow.Params({
            dcaOrdersSize: 3,
            priceDeviationBPS: 100,
            takeProfitBPS: 0,
            priceMultiplierBPS: 11_000,
            dcaOrderSizeMultiplierBPS: 500,
            baseOrderAmount: 1 ether,
            dcaOrderAmount: 1 ether
        });

        // Fund Alice
        token0.mint(alice, 1000 ether);
    }

    function test_CreateEscrow() public {
        // Calculate expected need
        uint256 expectedPull = 1 ether + 1 ether + 1.05 ether; // 3.05 ether

        vm.startPrank(alice);
        token0.approve(address(factory), type(uint256).max); // User approves factory? No, factory clones and calls init
        
        // Wait, Escrow.initialize transfers from `_owner` (Alice) to `address(this)` (the Escrow Clone).
        // So Alice needs to approve the CLONE, but the clone address is not known yet?
        // Ah, this is the "Approve-before-deploy" with Create2 or having factory pull?
        // Or standard pattern: Deploy, then Approve, then Initialize?
        // But `createEscrow` does `clone.initialize`.
        // So `initialize` runs atomically.
        // Alice must approve the FUTURE address of the clone?
        // OR the Factory could use `LibClone.cloneDate` to predict?
        // OR standard EscrowFactory could pull tokens to itself then push to clone?
        // BUT `Escrow.sol` calls `transferFrom(_owner, address(this), need0)`.
        
        // If we use standard `clone()`, address is random/nonce based?
        // CREATE: address = hash(sender, nonce). Sender is Factory. Nonce is known.
        // So we can predict.
        
        // HOWEVER, simpler pattern:
        // Initialize does NOT pull tokens? 
        // Or user approves FACTORY, Factory pulls, then Factory approves Clone, Clone pulls?
        // BUT `Escrow.initialize` pulls from `_owner`. `_owner` is passed as `alice` (msg.sender).
        // So Alice must approve the Clone.
        // This makes `createEscrow` tricky if address isn't known.
        // Solution: Factory uses `predictDeterministicAddress` (CREATE2) or ...?
        // Only feasible if Alice approves "everyone" (bad) or address is predictable.
        
        // Let's assume for this test we approve "all" or specific?
        // Or maybe logic is flawed?
        // If logic is flawed, test will fail and I need to notify user.
        // But for now let's try to verify if logic holds.
        // How can Alice approve a contract that doesn't exist? She can't.
        // So `createEscrow` will revert unless Alice has `approve(address(0), ...)`? No.
        
        // Does `LibClone.clone` use CREATE or CREATE2? `clone()` uses CREATE (nonce).
        // Predictable via nonce.
        
        // Maybe the user intends to modify Escrow to pull from msg.sender?
        // If Factory calls initialize, `msg.sender` is Factory.
        // Factory doesn't have tokens.
        // That's why `_owner` arg was added.
        
        // For the test, I can compute the address?
        address predicted = computeCreateAddress(address(factory), vm.getNonce(address(factory)));
        
        token0.approve(predicted, type(uint256).max);
        
        vm.expectEmit(true, true, false, true);
        emit EscrowCreated(predicted, alice, address(token0), address(token1));

        Escrow clone = factory.createEscrow(params, address(token0), address(token1), address(feed0), address(feed1));
        
        assertEq(address(clone), predicted);
        assertEq(clone.owner(), alice);
        assertEq(token0.balanceOf(address(clone)), expectedPull);
        
        vm.stopPrank();
    }
}
