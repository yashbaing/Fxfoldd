// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title ClearingRound
 * @notice Stores off-chain solver output and collects participant approvals (EIP-712).
 */
contract ClearingRound is EIP712 {
    using ECDSA for bytes32;

    enum RoundStatus {
        None,
        Proposed,
        Approved,
        Settled,
        Cancelled
    }

    struct NetPosition {
        address participant;
        int128 usdcDelta; // +receive / -pay, 6 decimals
        int128 eurcDelta;
        uint128 depositUsdc;
        uint128 depositEurc;
    }

    struct FxLeg {
        address seller; // sells fromCurrency
        address buyer;
        bytes32 fromCurrency;
        bytes32 toCurrency;
        uint128 fromAmount;
        uint128 toAmount;
        bool externalLeg; // true => residual StableFX
    }

    struct Round {
        bytes32 roundHash;
        RoundStatus status;
        uint64 createdAt;
        uint64 approvedCount;
        uint64 participantCount;
        uint128 externalLiquidityUsd;
        uint128 externalFxUsd;
        uint128 grossTradeUsd;
        uint128 grossFxUsd;
    }

    bytes32 public constant ROUND_APPROVAL_TYPEHASH =
        keccak256("RoundApproval(uint256 roundId,bytes32 roundHash)");

    address public operator;
    address public settlement;
    uint256 public nextRoundId;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => address[]) private _participants;
    mapping(uint256 => uint256[]) private _obligationIds;
    mapping(uint256 => NetPosition[]) private _netPositions;
    mapping(uint256 => FxLeg[]) private _fxLegs;
    mapping(uint256 => mapping(address => bool)) public approved;
    mapping(uint256 => mapping(address => bool)) public isParticipant;

    event RoundProposed(
        uint256 indexed roundId,
        bytes32 indexed roundHash,
        uint64 participantCount,
        uint128 externalLiquidityUsd,
        uint128 externalFxUsd
    );
    event RoundApproved(uint256 indexed roundId, address indexed participant);
    event RoundFullyApproved(uint256 indexed roundId);
    event RoundSettled(uint256 indexed roundId);
    event RoundCancelled(uint256 indexed roundId);
    event OperatorUpdated(address indexed operator);
    event SettlementUpdated(address indexed settlement);

    error NotOperator();
    error NotSettlement();
    error NotParticipant();
    error BadStatus();
    error AlreadyApproved();
    error InvalidSignature();
    error EmptyRound();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address operator_) EIP712("FXFold Clearing", "1") {
        operator = operator_;
        nextRoundId = 1;
    }

    function setOperator(address operator_) external onlyOperator {
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setSettlement(address settlement_) external onlyOperator {
        settlement = settlement_;
        emit SettlementUpdated(settlement_);
    }

    function proposeRound(
        bytes32 roundHash,
        address[] calldata participants,
        uint256[] calldata obligationIds,
        NetPosition[] calldata netPositions,
        FxLeg[] calldata fxLegs,
        uint128 externalLiquidityUsd,
        uint128 externalFxUsd,
        uint128 grossTradeUsd,
        uint128 grossFxUsd
    ) external onlyOperator returns (uint256 roundId) {
        if (participants.length == 0 || obligationIds.length == 0) revert EmptyRound();

        roundId = nextRoundId++;
        Round storage r = rounds[roundId];
        r.roundHash = roundHash;
        r.status = RoundStatus.Proposed;
        r.createdAt = uint64(block.timestamp);
        r.participantCount = uint64(participants.length);
        r.externalLiquidityUsd = externalLiquidityUsd;
        r.externalFxUsd = externalFxUsd;
        r.grossTradeUsd = grossTradeUsd;
        r.grossFxUsd = grossFxUsd;

        for (uint256 i = 0; i < participants.length; i++) {
            address p = participants[i];
            _participants[roundId].push(p);
            isParticipant[roundId][p] = true;
        }
        for (uint256 i = 0; i < obligationIds.length; i++) {
            _obligationIds[roundId].push(obligationIds[i]);
        }
        for (uint256 i = 0; i < netPositions.length; i++) {
            _netPositions[roundId].push(netPositions[i]);
        }
        for (uint256 i = 0; i < fxLegs.length; i++) {
            _fxLegs[roundId].push(fxLegs[i]);
        }

        emit RoundProposed(roundId, roundHash, r.participantCount, externalLiquidityUsd, externalFxUsd);
    }

    function approveRound(uint256 roundId) external {
        _approve(roundId, msg.sender);
    }

    function approveRoundWithSig(uint256 roundId, address participant, bytes calldata signature) external {
        Round storage r = rounds[roundId];
        bytes32 structHash = keccak256(abi.encode(ROUND_APPROVAL_TYPEHASH, roundId, r.roundHash));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != participant) revert InvalidSignature();
        _approve(roundId, participant);
    }

    /// @notice Demo helper: operator can approve on behalf of demo SMEs.
    function operatorApprove(uint256 roundId, address participant) external onlyOperator {
        _approve(roundId, participant);
    }

    function operatorApproveAll(uint256 roundId) external onlyOperator {
        address[] storage parts = _participants[roundId];
        for (uint256 i = 0; i < parts.length; i++) {
            if (!approved[roundId][parts[i]]) {
                _approve(roundId, parts[i]);
            }
        }
    }

    function markSettled(uint256 roundId) external {
        if (msg.sender != settlement && msg.sender != operator) revert NotSettlement();
        Round storage r = rounds[roundId];
        if (r.status != RoundStatus.Approved) revert BadStatus();
        r.status = RoundStatus.Settled;
        emit RoundSettled(roundId);
    }

    function cancelRound(uint256 roundId) external onlyOperator {
        Round storage r = rounds[roundId];
        if (r.status != RoundStatus.Proposed && r.status != RoundStatus.Approved) revert BadStatus();
        r.status = RoundStatus.Cancelled;
        emit RoundCancelled(roundId);
    }

    function getParticipants(uint256 roundId) external view returns (address[] memory) {
        return _participants[roundId];
    }

    function getObligationIds(uint256 roundId) external view returns (uint256[] memory) {
        return _obligationIds[roundId];
    }

    function getNetPositions(uint256 roundId) external view returns (NetPosition[] memory) {
        return _netPositions[roundId];
    }

    function getFxLegs(uint256 roundId) external view returns (FxLeg[] memory) {
        return _fxLegs[roundId];
    }

    function isFullyApproved(uint256 roundId) public view returns (bool) {
        Round storage r = rounds[roundId];
        return r.status == RoundStatus.Approved || r.approvedCount >= r.participantCount;
    }

    function _approve(uint256 roundId, address participant) internal {
        Round storage r = rounds[roundId];
        if (r.status != RoundStatus.Proposed && r.status != RoundStatus.Approved) revert BadStatus();
        if (!isParticipant[roundId][participant]) revert NotParticipant();
        if (approved[roundId][participant]) revert AlreadyApproved();

        approved[roundId][participant] = true;
        r.approvedCount += 1;
        emit RoundApproved(roundId, participant);

        if (r.approvedCount >= r.participantCount) {
            r.status = RoundStatus.Approved;
            emit RoundFullyApproved(roundId);
        }
    }
}
