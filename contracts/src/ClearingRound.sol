// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IFXFold} from "./interfaces/IFXFold.sol";

/// @title ClearingRound
/// @notice Stores solver output and collects participant EIP-712 approvals before settlement.
contract ClearingRound is IFXFold, EIP712, Ownable {
    using ECDSA for bytes32;

    bytes32 public constant ROUND_APPROVAL_TYPEHASH =
        keccak256("RoundApproval(uint256 roundId,bytes32 roundHash)");

    struct RoundInput {
        bytes32 roundHash;
        address[] participants;
        bytes32[] obligationIds;
        NetPosition[] netPositions;
        InternalFXMatch[] internalMatches;
        ExternalFXLeg[] externalFx;
        uint256 externalLiquidity;
        uint256 grossObligations;
        uint256 grossFxDemand;
    }

    struct Round {
        bytes32 roundHash;
        address[] participants;
        bytes32[] obligationIds;
        NetPosition[] netPositions;
        InternalFXMatch[] internalMatches;
        ExternalFXLeg[] externalFx;
        uint256 externalLiquidity;
        uint256 grossObligations;
        uint256 grossFxDemand;
        RoundStatus status;
        uint256 approvalCount;
    }

    uint256 public roundCount;
    mapping(uint256 => Round) private _rounds;
    mapping(uint256 => mapping(address => bool)) public hasApproved;

    event RoundCreated(uint256 indexed roundId, bytes32 roundHash, uint256 participantCount);
    event RoundApproved(uint256 indexed roundId, address indexed participant);
    event RoundStatusChanged(uint256 indexed roundId, RoundStatus status);

    constructor(address owner_) EIP712("FXFold", "1") Ownable(owner_) {}

    function createRound(RoundInput calldata input) external onlyOwner returns (uint256 roundId) {
        roundId = ++roundCount;
        Round storage r = _rounds[roundId];
        r.roundHash = input.roundHash;
        r.participants = input.participants;
        r.obligationIds = input.obligationIds;
        r.netPositions = input.netPositions;
        r.internalMatches = input.internalMatches;
        r.externalFx = input.externalFx;
        r.externalLiquidity = input.externalLiquidity;
        r.grossObligations = input.grossObligations;
        r.grossFxDemand = input.grossFxDemand;
        r.status = RoundStatus.Approving;
        emit RoundCreated(roundId, input.roundHash, input.participants.length);
        emit RoundStatusChanged(roundId, RoundStatus.Approving);
    }

    function approveRound(uint256 roundId, bytes calldata signature) external {
        Round storage r = _rounds[roundId];
        require(r.status == RoundStatus.Approving, "Not approving");
        require(!hasApproved[roundId][msg.sender], "Already approved");

        bool isParticipant;
        for (uint256 i = 0; i < r.participants.length; i++) {
            if (r.participants[i] == msg.sender) {
                isParticipant = true;
                break;
            }
        }
        require(isParticipant, "Not participant");

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(ROUND_APPROVAL_TYPEHASH, roundId, r.roundHash))
        );
        address signer = digest.recover(signature);
        require(signer == msg.sender, "Bad signature");

        hasApproved[roundId][msg.sender] = true;
        r.approvalCount++;
        emit RoundApproved(roundId, msg.sender);

        if (r.approvalCount == r.participants.length) {
            r.status = RoundStatus.Approved;
            emit RoundStatusChanged(roundId, RoundStatus.Approved);
        }
    }

    function markSettled(uint256 roundId) external onlyOwner {
        Round storage r = _rounds[roundId];
        require(r.status == RoundStatus.Approved, "Not approved");
        r.status = RoundStatus.Settled;
        emit RoundStatusChanged(roundId, RoundStatus.Settled);
    }

    function getRound(uint256 roundId)
        external
        view
        returns (
            bytes32 roundHash,
            address[] memory participants,
            bytes32[] memory obligationIds,
            NetPosition[] memory netPositions,
            InternalFXMatch[] memory internalMatches,
            ExternalFXLeg[] memory externalFx,
            uint256 externalLiquidity,
            uint256 grossObligations,
            uint256 grossFxDemand,
            RoundStatus status,
            uint256 approvalCount
        )
    {
        Round storage r = _rounds[roundId];
        return (
            r.roundHash,
            r.participants,
            r.obligationIds,
            r.netPositions,
            r.internalMatches,
            r.externalFx,
            r.externalLiquidity,
            r.grossObligations,
            r.grossFxDemand,
            r.status,
            r.approvalCount
        );
    }

    function getApprovalDigest(uint256 roundId) external view returns (bytes32) {
        Round storage r = _rounds[roundId];
        return _hashTypedDataV4(keccak256(abi.encode(ROUND_APPROVAL_TYPEHASH, roundId, r.roundHash)));
    }
}
