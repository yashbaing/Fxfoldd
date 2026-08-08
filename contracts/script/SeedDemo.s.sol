// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ObligationRegistry} from "../src/ObligationRegistry.sol";
import {ClearingRound} from "../src/ClearingRound.sol";
import {AtomicSettlement} from "../src/AtomicSettlement.sol";

/**
 * @notice Seeds a participant-ready clearing round.
 *         7 SMEs are pre-authorized; one live wallet joins + funds net position.
 */
contract SeedDemo is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address registryAddr = vm.envAddress("OBLIGATION_REGISTRY");
        address clearingAddr = vm.envAddress("CLEARING_ROUND");
        address settlementAddr = vm.envAddress("ATOMIC_SETTLEMENT");

        ObligationRegistry registry = ObligationRegistry(registryAddr);
        ClearingRound clearing = ClearingRound(clearingAddr);
        AtomicSettlement settlement = AtomicSettlement(settlementAddr);

        address[8] memory smes = [
            address(0x1111111111111111111111111111111111111111),
            address(0x2222222222222222222222222222222222222222),
            address(0x3333333333333333333333333333333333333333),
            address(0x4444444444444444444444444444444444444444), // SME D slot — live wallet maps here in UI
            address(0x5555555555555555555555555555555555555555),
            address(0x6666666666666666666666666666666666666666),
            address(0x7777777777777777777777777777777777777777),
            address(0x8888888888888888888888888888888888888888)
        ];

        bytes32 USD = keccak256("USD");
        bytes32 EUR = keccak256("EUR");
        bytes32 AED = keccak256("AED");
        bytes32 USDC = keccak256("USDC");
        bytes32 EURC = keccak256("EURC");

        vm.startBroadcast(pk);

        uint256[] memory ids = new uint256[](12);
        ids[0] = registry.proposeObligation(keccak256("INV-001"), smes[0], smes[1], 100_000e6, USD, USDC, uint64(block.timestamp + 30 days));
        ids[1] = registry.proposeObligation(keccak256("INV-002"), smes[1], smes[2], 95_000e6, USD, USDC, uint64(block.timestamp + 30 days));
        ids[2] = registry.proposeObligation(keccak256("INV-003"), smes[2], smes[3], 90_000e6, USD, USDC, uint64(block.timestamp + 30 days));
        ids[3] = registry.proposeObligation(keccak256("INV-004"), smes[3], smes[0], 80_000e6, USD, USDC, uint64(block.timestamp + 30 days));
        ids[4] = registry.proposeObligation(keccak256("INV-005"), smes[0], smes[1], 50_000e6, EUR, EURC, uint64(block.timestamp + 30 days));
        ids[5] = registry.proposeObligation(keccak256("INV-006"), smes[1], smes[4], 47_000e6, EUR, EURC, uint64(block.timestamp + 30 days));
        ids[6] = registry.proposeObligation(keccak256("INV-007"), smes[4], smes[0], 42_000e6, EUR, EURC, uint64(block.timestamp + 30 days));
        ids[7] = registry.proposeObligation(keccak256("INV-008"), smes[4], smes[5], 220_000e6, AED, USDC, uint64(block.timestamp + 30 days));
        ids[8] = registry.proposeObligation(keccak256("INV-009"), smes[5], smes[6], 200_000e6, AED, USDC, uint64(block.timestamp + 30 days));
        ids[9] = registry.proposeObligation(keccak256("INV-010"), smes[6], smes[4], 180_000e6, AED, USDC, uint64(block.timestamp + 30 days));
        ids[10] = registry.proposeObligation(keccak256("INV-011"), smes[2], smes[5], 55_000e6, USD, USDC, uint64(block.timestamp + 30 days));
        ids[11] = registry.proposeObligation(keccak256("INV-012"), smes[5], smes[2], 45_000e6, USD, USDC, uint64(block.timestamp + 30 days));

        registry.markIncluded(ids);

        address[] memory participants = new address[](8);
        for (uint256 i = 0; i < 8; i++) participants[i] = smes[i];

        ClearingRound.NetPosition[] memory nets = new ClearingRound.NetPosition[](8);
        nets[0] = ClearingRound.NetPosition(smes[0], int128(9_108e6), int128(-8_000e6), 0, 8_000e6);
        nets[1] = ClearingRound.NetPosition(smes[1], 0, int128(-4_528e6), 0, 4_528e6);
        nets[2] = ClearingRound.NetPosition(smes[2], int128(445e6), int128(-2_000e6), 0, 2_000e6);
        nets[3] = ClearingRound.NetPosition(smes[3], int128(-15_229e6), int128(25_586e6), 15_229e6, 0);
        nets[4] = ClearingRound.NetPosition(smes[4], int128(-4_554e6), int128(-20_000e6), 4_554e6, 20_000e6);
        nets[5] = ClearingRound.NetPosition(smes[5], int128(10_000e6), int128(22_509e6), 0, 0);
        nets[6] = ClearingRound.NetPosition(smes[6], int128(8_000e6), int128(7_019e6), 0, 0);
        nets[7] = ClearingRound.NetPosition(smes[7], int128(-7_770e6), int128(-20_586e6), 7_770e6, 20_586e6);

        ClearingRound.FxLeg[] memory legs = new ClearingRound.FxLeg[](2);
        legs[0] = ClearingRound.FxLeg(smes[0], smes[3], USDC, EURC, 8_680e6, 8_000e6, false);
        legs[1] = ClearingRound.FxLeg(smes[3], smes[3], USDC, EURC, 6_100e6, 6_100e6, true);

        bytes32 roundHash = keccak256(abi.encodePacked("fxfold-sme-demo", block.timestamp));
        uint256 roundId = clearing.proposeRound(
            roundHash,
            participants,
            ids,
            nets,
            legs,
            87_000e6,
            6_100e6,
            1_490_000e6,
            310_000e6
        );
        clearing.operatorApproveAll(roundId);

        // 5 USDC demo deposit for the live SME (faucet-sized proof of net-position funding)
        settlement.prepareParticipantRound(roundId, 5e6, 0);

        vm.stopBroadcast();

        console2.log("SEEDED_ROUND_ID", roundId);
        console2.log("REQUIRED_USDC_DEMO", uint256(5e6));
        console2.log("OBLIGATIONS", ids.length);
        console2.logBytes32(roundHash);
    }
}
