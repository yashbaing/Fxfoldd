// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {ObligationRegistry} from "./ObligationRegistry.sol";
import {ClearingRound} from "./ClearingRound.sol";

/**
 * @title AtomicSettlement
 * @notice Escrow + atomic clearing settlement on Arc.
 *         Demo path: one live SME joins, funds their net position; peers are pre-authorized.
 */
contract AtomicSettlement {
    struct TransferLeg {
        address token;
        address from;
        address to;
        uint128 amount;
    }

    ObligationRegistry public immutable registry;
    ClearingRound public immutable clearing;
    address public immutable usdc;
    address public immutable eurc;
    address public operator;
    address public stableFxAdapter;
    address public releaseReceiver;

    mapping(uint256 => bool) public settledRounds;
    mapping(address => mapping(address => uint256)) public deposits; // token => account => amount

    // Participant demo flow
    mapping(uint256 => address) public joinedWallet;
    mapping(uint256 => bool) public peersReady;
    mapping(uint256 => bool) public positionFunded;
    mapping(uint256 => uint256) public requiredUsdc;
    mapping(uint256 => uint256) public requiredEurc;
    mapping(uint256 => bytes32) public lastSettleTxHint;

    event Deposited(address indexed token, address indexed account, uint256 amount);
    event Withdrawn(address indexed token, address indexed account, uint256 amount);
    event JoinedRound(uint256 indexed roundId, address indexed wallet);
    event PeersReady(uint256 indexed roundId);
    event NetPositionFunded(uint256 indexed roundId, address indexed wallet, uint256 usdcAmount, uint256 eurcAmount);
    event RoundSettled(
        uint256 indexed roundId,
        bytes32 indexed roundHash,
        uint256 transferCount,
        uint256 obligationCount,
        uint128 externalLiquidityUsd,
        uint128 externalFxUsd
    );
    event ResidualFxExecuted(uint256 indexed roundId, address indexed adapter, uint128 fromAmount, uint128 toAmount);
    event OperatorUpdated(address indexed operator);
    event AdapterUpdated(address indexed adapter);
    event ReleaseReceiverUpdated(address indexed receiver);

    error NotOperator();
    error AlreadySettled();
    error RoundNotApproved();
    error InsufficientDeposit();
    error TransferFailed();
    error ZeroAddress();
    error AlreadyJoined();
    error NotJoined();
    error PeersNotReady();
    error AlreadyFunded();
    error NotConfigured();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(
        address operator_,
        address registry_,
        address clearing_,
        address usdc_,
        address eurc_,
        address adapter_,
        address releaseReceiver_
    ) {
        if (
            operator_ == address(0) || registry_ == address(0) || clearing_ == address(0) || usdc_ == address(0)
                || eurc_ == address(0)
        ) revert ZeroAddress();
        operator = operator_;
        registry = ObligationRegistry(registry_);
        clearing = ClearingRound(clearing_);
        usdc = usdc_;
        eurc = eurc_;
        stableFxAdapter = adapter_;
        releaseReceiver = releaseReceiver_ == address(0) ? operator_ : releaseReceiver_;
    }

    function setOperator(address operator_) external onlyOperator {
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setStableFxAdapter(address adapter_) external onlyOperator {
        stableFxAdapter = adapter_;
        emit AdapterUpdated(adapter_);
    }

    function setReleaseReceiver(address receiver_) external onlyOperator {
        releaseReceiver = receiver_;
        emit ReleaseReceiverUpdated(receiver_);
    }

    function deposit(address token, uint256 amount) external {
        if (!IERC20Minimal(token).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        deposits[token][msg.sender] += amount;
        emit Deposited(token, msg.sender, amount);
    }

    function withdraw(address token, uint256 amount) external {
        uint256 bal = deposits[token][msg.sender];
        if (bal < amount) revert InsufficientDeposit();
        deposits[token][msg.sender] = bal - amount;
        if (!IERC20Minimal(token).transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(token, msg.sender, amount);
    }

    /**
     * @notice Operator configures the live-SME funding requirement and marks 7 peers ready.
     */
    function prepareParticipantRound(uint256 roundId, uint256 usdcRequired, uint256 eurcRequired)
        external
        onlyOperator
    {
        requiredUsdc[roundId] = usdcRequired;
        requiredEurc[roundId] = eurcRequired;
        peersReady[roundId] = true;
        emit PeersReady(roundId);
    }

    /**
     * @notice Connected SME joins the clearing round (one live wallet per round).
     */
    function joinRound(uint256 roundId) external {
        if (settledRounds[roundId]) revert AlreadySettled();
        address existing = joinedWallet[roundId];
        if (existing != address(0) && existing != msg.sender) revert AlreadyJoined();
        joinedWallet[roundId] = msg.sender;
        emit JoinedRound(roundId, msg.sender);
    }

    /**
     * @notice Live SME funds their final net position. When peers are ready, the round settles on Arc.
     * @dev Real USDC/EURC transferFrom the connected wallet — not an admin action.
     */
    function fundNetPosition(uint256 roundId) external {
        if (settledRounds[roundId]) revert AlreadySettled();
        if (joinedWallet[roundId] != msg.sender) revert NotJoined();
        if (!peersReady[roundId]) revert PeersNotReady();
        if (positionFunded[roundId]) revert AlreadyFunded();
        if (!clearing.isFullyApproved(roundId)) revert RoundNotApproved();

        uint256 usdcAmount = requiredUsdc[roundId];
        uint256 eurcAmount = requiredEurc[roundId];
        if (usdcAmount == 0 && eurcAmount == 0) revert NotConfigured();

        if (usdcAmount > 0) {
            if (!IERC20Minimal(usdc).transferFrom(msg.sender, address(this), usdcAmount)) revert TransferFailed();
            deposits[usdc][msg.sender] += usdcAmount;
        }
        if (eurcAmount > 0) {
            if (!IERC20Minimal(eurc).transferFrom(msg.sender, address(this), eurcAmount)) revert TransferFailed();
            deposits[eurc][msg.sender] += eurcAmount;
        }

        positionFunded[roundId] = true;
        emit NetPositionFunded(roundId, msg.sender, usdcAmount, eurcAmount);

        _finalizeParticipantSettlement(roundId, usdcAmount, eurcAmount);
    }

    /**
     * @notice Operator path for full transfer-leg settlement (unchanged advanced path).
     */
    function settleRound(
        uint256 roundId,
        TransferLeg[] calldata transfers,
        address fxFromToken,
        address fxToToken,
        uint128 fxFromAmount,
        uint128 fxToAmount
    ) external onlyOperator {
        if (settledRounds[roundId]) revert AlreadySettled();
        if (!clearing.isFullyApproved(roundId)) revert RoundNotApproved();

        (bytes32 roundHash,,,,, uint128 externalLiquidityUsd, uint128 externalFxUsd,,) = clearing.rounds(roundId);

        if (fxFromAmount > 0 && stableFxAdapter != address(0)) {
            _executeResidualFx(roundId, fxFromToken, fxToToken, fxFromAmount, fxToAmount);
        }

        for (uint256 i = 0; i < transfers.length; i++) {
            TransferLeg calldata t = transfers[i];
            _payFromDeposit(t.token, t.from, t.to, t.amount);
        }

        uint256[] memory obligationIds = clearing.getObligationIds(roundId);
        registry.markSettled(obligationIds);
        settledRounds[roundId] = true;
        clearing.markSettled(roundId);

        emit RoundSettled(
            roundId, roundHash, transfers.length, obligationIds.length, externalLiquidityUsd, externalFxUsd
        );
    }

    function fundingStatus(uint256 roundId)
        external
        view
        returns (
            address wallet,
            bool peers,
            bool funded,
            bool settled,
            uint256 usdcRequired,
            uint256 eurcRequired
        )
    {
        return (
            joinedWallet[roundId],
            peersReady[roundId],
            positionFunded[roundId],
            settledRounds[roundId],
            requiredUsdc[roundId],
            requiredEurc[roundId]
        );
    }

    function _finalizeParticipantSettlement(uint256 roundId, uint256 usdcAmount, uint256 eurcAmount) internal {
        (bytes32 roundHash,,,,, uint128 externalLiquidityUsd, uint128 externalFxUsd,,) = clearing.rounds(roundId);

        // Move funded net position to receiver (LP / clearing liquidity sink) for demo finality
        address sink = releaseReceiver;
        if (usdcAmount > 0) {
            deposits[usdc][msg.sender] -= usdcAmount;
            if (!IERC20Minimal(usdc).transfer(sink, usdcAmount)) revert TransferFailed();
        }
        if (eurcAmount > 0) {
            deposits[eurc][msg.sender] -= eurcAmount;
            if (!IERC20Minimal(eurc).transfer(sink, eurcAmount)) revert TransferFailed();
        }

        uint256[] memory obligationIds = clearing.getObligationIds(roundId);
        registry.markSettled(obligationIds);

        settledRounds[roundId] = true;
        clearing.markSettled(roundId);
        lastSettleTxHint[roundId] = roundHash;

        emit RoundSettled(roundId, roundHash, 1, obligationIds.length, externalLiquidityUsd, externalFxUsd);
    }

    function _executeResidualFx(
        uint256 roundId,
        address fromToken,
        address toToken,
        uint128 fromAmount,
        uint128 toAmount
    ) internal {
        address lp = releaseReceiver;
        uint256 fromBal = deposits[fromToken][lp];
        if (fromBal < fromAmount) revert InsufficientDeposit();
        deposits[fromToken][lp] = fromBal - fromAmount;

        if (!IERC20Minimal(fromToken).approve(stableFxAdapter, fromAmount)) revert TransferFailed();

        (bool ok, bytes memory data) = stableFxAdapter.call(
            abi.encodeWithSignature(
                "executeRfq(address,address,uint256,uint256,address)",
                fromToken,
                toToken,
                uint256(fromAmount),
                uint256(toAmount),
                address(this)
            )
        );
        if (!ok) {
            assembly {
                revert(add(data, 32), mload(data))
            }
        }

        deposits[toToken][lp] += toAmount;
        emit ResidualFxExecuted(roundId, stableFxAdapter, fromAmount, toAmount);
    }

    function _payFromDeposit(address token, address from, address to, uint128 amount) internal {
        if (amount == 0) return;
        uint256 bal = deposits[token][from];
        if (bal < amount) {
            address lp = releaseReceiver;
            uint256 need = amount - bal;
            uint256 lpBal = deposits[token][lp];
            if (lpBal < need) revert InsufficientDeposit();
            if (bal > 0) deposits[token][from] = 0;
            deposits[token][lp] = lpBal - need;
        } else {
            deposits[token][from] = bal - amount;
        }
        if (!IERC20Minimal(token).transfer(to, amount)) revert TransferFailed();
    }
}
