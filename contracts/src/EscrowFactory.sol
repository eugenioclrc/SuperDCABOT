// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {LibClone} from "solady/utils/LibClone.sol";
import {Escrow} from "./Escrow.sol";

contract EscrowFactory {
    using LibClone for address;

    address public immutable implementation;

    event EscrowCreated(address indexed escrow, address indexed owner, address asset0, address asset1);

    constructor(address _implementation) {
        implementation = _implementation;
    }

    function createEscrow(Escrow.Params memory params, address asset0, address asset1, address feed0, address feed1)
        external
        returns (Escrow)
    {
        address cloneAddr = implementation.clone();
        Escrow(cloneAddr).initialize(params, asset0, asset1, feed0, feed1, msg.sender);
        emit EscrowCreated(cloneAddr, msg.sender, asset0, asset1);
        return Escrow(cloneAddr);
    }
}
