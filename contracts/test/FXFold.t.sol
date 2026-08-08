// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ObligationRegistry} from "../src/ObligationRegistry.sol";
import {ClearingRound} from "../src/ClearingRound.sol";
import {AtomicSettlement} from "../src/AtomicSettlement.sol";
import {StableFXAdapter} from "../src/StableFXAdapter.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract FXFoldTest is Test {
    ObligationRegistry registry;
    ClearingRound clearing;
    AtomicSettlement settlement;
    StableFXAdapter adapter;
    MockERC20 usdc;
    MockERC20 eurc;

    address operator = address(0xA11CE);
    address a = address(0x1);
    address b = address(0x2);
    address c = address(0x3);

    bytes32 constant CUR_USD = keccak256("USD");
    bytes32 constant CUR_EUR = keccak256("EUR");
    bytes32 constant SET_USDC = keccak256("USDC");
    bytes32 constant SET_EURC = keccak256("EURC");

    function setUp() public {
        vm.startPrank(operator);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        eurc = new MockERC20("Euro Coin", "EURC", 6);
        registry = new ObligationRegistry(operator);
        clearing = new ClearingRound(operator);
        adapter = new StableFXAdapter(operator);
        settlement = new AtomicSettlement(
            operator, address(registry), address(clearing), address(usdc), address(eurc), address(adapter), operator
        ); // releaseReceiver = operator
        registry.setSettlement(address(settlement));
        clearing.setSettlement(address(settlement));
        vm.stopPrank();

        usdc.mint(operator, 1_000_000e6);
        eurc.mint(operator, 1_000_000e6);
        usdc.mint(a, 500_000e6);
        eurc.mint(b, 500_000e6);
    }

    function test_bilateralAcceptanceAndAtomicSettle() public {
        vm.prank(operator);
        uint256 id1 = registry.proposeObligation(
            keccak256("inv-1"), a, b, 100_000e6, CUR_USD, SET_USDC, uint64(block.timestamp + 7 days)
        );
        vm.prank(operator);
        uint256 id2 = registry.proposeObligation(
            keccak256("inv-2"), b, c, 80_000e6, CUR_EUR, SET_EURC, uint64(block.timestamp + 7 days)
        );
        vm.prank(operator);
        uint256 id3 = registry.proposeObligation(
            keccak256("inv-3"), c, a, 90_000e6, CUR_USD, SET_USDC, uint64(block.timestamp + 7 days)
        );

        assertEq(uint256(registry.getObligation(id1).status), uint256(ObligationRegistry.Status.Accepted));

        address[] memory participants = new address[](3);
        participants[0] = a;
        participants[1] = b;
        participants[2] = c;
        uint256[] memory ids = new uint256[](3);
        ids[0] = id1;
        ids[1] = id2;
        ids[2] = id3;

        ClearingRound.NetPosition[] memory nets = new ClearingRound.NetPosition[](3);
        nets[0] = ClearingRound.NetPosition(a, int128(10_000e6), 0, 0, 0);
        nets[1] = ClearingRound.NetPosition(b, int128(-10_000e6), int128(80_000e6), 10_000e6, 0);
        nets[2] = ClearingRound.NetPosition(c, 0, int128(-80_000e6), 0, 80_000e6);

        ClearingRound.FxLeg[] memory legs = new ClearingRound.FxLeg[](1);
        legs[0] = ClearingRound.FxLeg(b, c, SET_USDC, SET_EURC, 20_000e6, 20_000e6, true);

        bytes32 roundHash = keccak256("demo-round");

        vm.startPrank(operator);
        registry.markIncluded(ids);
        uint256 roundId = clearing.proposeRound(
            roundHash, participants, ids, nets, legs, 10_000e6, 20_000e6, 270_000e6, 20_000e6
        );
        clearing.operatorApproveAll(roundId);

        // Fund settlement deposits + adapter liquidity
        usdc.approve(address(settlement), type(uint256).max);
        eurc.approve(address(settlement), type(uint256).max);
        settlement.deposit(address(usdc), 100_000e6);
        settlement.deposit(address(eurc), 100_000e6);

        usdc.approve(address(adapter), type(uint256).max);
        eurc.approve(address(adapter), type(uint256).max);
        adapter.seedLiquidity(address(usdc), 50_000e6);
        adapter.seedLiquidity(address(eurc), 50_000e6);

        AtomicSettlement.TransferLeg[] memory transfers = new AtomicSettlement.TransferLeg[](2);
        transfers[0] = AtomicSettlement.TransferLeg(address(usdc), operator, a, 10_000e6);
        transfers[1] = AtomicSettlement.TransferLeg(address(eurc), operator, b, 20_000e6);

        settlement.settleRound(roundId, transfers, address(usdc), address(eurc), 20_000e6, 20_000e6);
        vm.stopPrank();

        assertEq(uint256(registry.getObligation(id1).status), uint256(ObligationRegistry.Status.Settled));
        assertEq(uint256(registry.getObligation(id2).status), uint256(ObligationRegistry.Status.Settled));
        assertEq(uint256(registry.getObligation(id3).status), uint256(ObligationRegistry.Status.Settled));
        assertTrue(settlement.settledRounds(roundId));
    }

    function test_liveSmeJoinsAndFundsNetPosition() public {
        vm.startPrank(operator);
        uint256 id1 = registry.proposeObligation(
            keccak256("inv-a"), a, b, 50_000e6, CUR_USD, SET_USDC, uint64(block.timestamp + 7 days)
        );
        address[] memory participants = new address[](2);
        participants[0] = a;
        participants[1] = b;
        uint256[] memory ids = new uint256[](1);
        ids[0] = id1;
        ClearingRound.NetPosition[] memory nets = new ClearingRound.NetPosition[](2);
        nets[0] = ClearingRound.NetPosition(a, int128(-5e6), 0, 5e6, 0);
        nets[1] = ClearingRound.NetPosition(b, int128(5e6), 0, 0, 0);
        ClearingRound.FxLeg[] memory legs = new ClearingRound.FxLeg[](0);
        registry.markIncluded(ids);
        uint256 roundId =
            clearing.proposeRound(keccak256("r2"), participants, ids, nets, legs, 5e6, 0, 50_000e6, 0);
        clearing.operatorApproveAll(roundId);
        settlement.prepareParticipantRound(roundId, 5e6, 0);
        vm.stopPrank();

        // Live SME wallet = address(a)
        vm.startPrank(a);
        usdc.approve(address(settlement), type(uint256).max);
        settlement.joinRound(roundId);
        settlement.fundNetPosition(roundId);
        vm.stopPrank();

        assertTrue(settlement.positionFunded(roundId));
        assertTrue(settlement.settledRounds(roundId));
        assertEq(settlement.joinedWallet(roundId), a);
    }
}
