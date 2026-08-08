// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ObligationRegistry} from "../src/ObligationRegistry.sol";
import {ClearingRound} from "../src/ClearingRound.sol";
import {AtomicSettlement} from "../src/AtomicSettlement.sol";
import {IFXFold} from "../src/interfaces/IFXFold.sol";
import {MockERC20} from "./MockERC20.sol";

contract FXFoldTest is Test {
    ObligationRegistry registry;
    ClearingRound clearing;
    AtomicSettlement settlement;
    MockERC20 usdc;
    MockERC20 eurc;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC");
        eurc = new MockERC20("EURC", "EURC");

        registry = new ObligationRegistry(address(this));
        clearing = new ClearingRound(address(this));
        settlement = new AtomicSettlement(address(this), address(usdc), address(eurc), address(clearing), address(registry));
    }

    function testObligationCreation() public {
        bytes32 invoiceId = keccak256("INV-001");
        registry.createObligation(
            invoiceId,
            alice,
            bob,
            100_000_000,
            IFXFold.InvoiceCurrency.USD,
            IFXFold.SettlementCurrency.USDC,
            block.timestamp + 30 days
        );

        bytes32[] memory ids = registry.getAcceptedObligationIds();
        assertEq(ids.length, 0);
    }

}
