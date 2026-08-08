// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ObligationRegistry} from "../src/ObligationRegistry.sol";
import {ClearingRound} from "../src/ClearingRound.sol";
import {AtomicSettlement} from "../src/AtomicSettlement.sol";
import {StableFXAdapter} from "../src/StableFXAdapter.sol";

contract Deploy is Script {
    // Arc Testnet canonical addresses
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        ObligationRegistry registry = new ObligationRegistry(deployer);
        ClearingRound clearing = new ClearingRound(deployer);
        AtomicSettlement settlement = new AtomicSettlement(deployer, USDC, EURC, address(clearing), address(registry));
        StableFXAdapter stableFx = new StableFXAdapter(deployer, USDC, EURC);

        vm.stopBroadcast();

        console2.log("ObligationRegistry:", address(registry));
        console2.log("ClearingRound:", address(clearing));
        console2.log("AtomicSettlement:", address(settlement));
        console2.log("StableFXAdapter:", address(stableFx));
    }
}
