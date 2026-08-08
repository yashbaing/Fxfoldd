// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ObligationRegistry} from "../src/ObligationRegistry.sol";
import {ClearingRound} from "../src/ClearingRound.sol";
import {AtomicSettlement} from "../src/AtomicSettlement.sol";
import {StableFXAdapter} from "../src/StableFXAdapter.sol";

contract Deploy is Script {
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        ObligationRegistry registry = new ObligationRegistry(deployer);
        ClearingRound clearing = new ClearingRound(deployer);
        StableFXAdapter adapter = new StableFXAdapter(deployer);
        AtomicSettlement settlement = new AtomicSettlement(
            deployer, address(registry), address(clearing), USDC, EURC, address(adapter), deployer
        );

        registry.setSettlement(address(settlement));
        clearing.setSettlement(address(settlement));

        vm.stopBroadcast();

        console2.log("DEPLOYER", deployer);
        console2.log("OBLIGATION_REGISTRY", address(registry));
        console2.log("CLEARING_ROUND", address(clearing));
        console2.log("ATOMIC_SETTLEMENT", address(settlement));
        console2.log("STABLEFX_ADAPTER", address(adapter));
        console2.log("USDC", USDC);
        console2.log("EURC", EURC);

        string memory json = string.concat(
            "{\n",
            '  "network": "arc-testnet",\n',
            '  "chainId": 5042002,\n',
            '  "deployer": "',
            vm.toString(deployer),
            '",\n',
            '  "obligationRegistry": "',
            vm.toString(address(registry)),
            '",\n',
            '  "clearingRound": "',
            vm.toString(address(clearing)),
            '",\n',
            '  "atomicSettlement": "',
            vm.toString(address(settlement)),
            '",\n',
            '  "stableFxAdapter": "',
            vm.toString(address(adapter)),
            '",\n',
            '  "usdc": "',
            vm.toString(USDC),
            '",\n',
            '  "eurc": "',
            vm.toString(EURC),
            '"\n',
            "}\n"
        );
        vm.writeFile("deployments/arc-testnet.json", json);
    }
}
