// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IFXFold} from "./interfaces/IFXFold.sol";
import {ClearingRound} from "./ClearingRound.sol";
import {ObligationRegistry} from "./ObligationRegistry.sol";

/// @title AtomicSettlement
/// @notice Executes approved clearing rounds atomically — all transfers succeed or the entire round reverts.
contract AtomicSettlement is IFXFold, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IERC20 public immutable eurc;
    ClearingRound public immutable clearingRound;
    ObligationRegistry public immutable obligationRegistry;

    event SettlementExecuted(uint256 indexed roundId, uint256 totalMoved, uint256 obligationsSettled);
    event PositionSettled(uint256 indexed roundId, address indexed participant, SettlementCurrency currency, int256 amount);

    constructor(
        address owner_,
        address usdc_,
        address eurc_,
        address clearingRound_,
        address obligationRegistry_
    ) Ownable(owner_) {
        usdc = IERC20(usdc_);
        eurc = IERC20(eurc_);
        clearingRound = ClearingRound(clearingRound_);
        obligationRegistry = ObligationRegistry(obligationRegistry_);
    }

    function settleRound(uint256 roundId) external nonReentrant onlyOwner {
        (
            ,
            ,
            bytes32[] memory obligationIds,
            NetPosition[] memory netPositions,
            ,
            ,
            uint256 externalLiquidity,
            ,
            ,
            RoundStatus status,
        ) = clearingRound.getRound(roundId);

        require(status == RoundStatus.Approved, "Round not approved");

        uint256 totalMoved;
        for (uint256 i = 0; i < netPositions.length; i++) {
            NetPosition memory pos = netPositions[i];
            if (pos.amount == 0) continue;

            IERC20 token = pos.currency == SettlementCurrency.USDC ? usdc : eurc;

            if (pos.amount < 0) {
                uint256 payAmount = uint256(-pos.amount);
                token.safeTransferFrom(pos.participant, address(this), payAmount);
                totalMoved += payAmount;
            } else {
                uint256 receiveAmount = uint256(pos.amount);
                token.safeTransfer(pos.participant, receiveAmount);
            }

            emit PositionSettled(roundId, pos.participant, pos.currency, pos.amount);
        }

        obligationRegistry.markInClearing(obligationIds);
        obligationRegistry.markSettled(obligationIds);
        clearingRound.markSettled(roundId);

        emit SettlementExecuted(roundId, totalMoved > 0 ? totalMoved : externalLiquidity, obligationIds.length);
    }

    /// @notice Participants must approve this contract before settlement.
    function requiredAllowance(SettlementCurrency currency) external view returns (address token) {
        return currency == SettlementCurrency.USDC ? address(usdc) : address(eurc);
    }
}
