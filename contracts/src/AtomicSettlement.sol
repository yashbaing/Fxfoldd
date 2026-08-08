// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {ObligationRegistry} from "./ObligationRegistry.sol";
import {ClearingRound} from "./ClearingRound.sol";

/**
 * @title AtomicSettlement
 * @notice Executes a clearing round atomically: residual FX via adapter, net transfers, settle obligations.
 *         Entire round succeeds or reverts — Arc as programmable multi-party settlement.
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
    address public liquidityProvider;

    mapping(uint256 => bool) public settledRounds;
    mapping(address => mapping(address => uint256)) public deposits; // token => account => amount

    event Deposited(address indexed token, address indexed account, uint256 amount);
    event Withdrawn(address indexed token, address indexed account, uint256 amount);
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
    event LiquidityProviderUpdated(address indexed lp);

    error NotOperator();
    error AlreadySettled();
    error RoundNotApproved();
    error InsufficientDeposit();
    error TransferFailed();
    error LengthMismatch();
    error ZeroAddress();

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
        address lp_
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
        liquidityProvider = lp_;
    }

    function setOperator(address operator_) external onlyOperator {
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setStableFxAdapter(address adapter_) external onlyOperator {
        stableFxAdapter = adapter_;
        emit AdapterUpdated(adapter_);
    }

    function setLiquidityProvider(address lp_) external onlyOperator {
        liquidityProvider = lp_;
        emit LiquidityProviderUpdated(lp_);
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
     * @notice Atomically settle an approved clearing round.
     * @param roundId Clearing round id
     * @param transfers Net settlement transfers (pull from deposits / LP)
     * @param fxFromToken Residual FX sell token (address(0) if none)
     * @param fxToToken Residual FX buy token
     * @param fxFromAmount Residual FX from amount
     * @param fxToAmount Residual FX to amount (quoted)
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

        (
            bytes32 roundHash,
            ,
            ,
            ,
            ,
            uint128 externalLiquidityUsd,
            uint128 externalFxUsd,
            ,
        ) = clearing.rounds(roundId);

        // 1) Residual FX via StableFX adapter (mock or live)
        if (fxFromAmount > 0 && stableFxAdapter != address(0)) {
            _executeResidualFx(roundId, fxFromToken, fxToToken, fxFromAmount, fxToAmount);
        }

        // 2) Net transfers from deposits (LP may fund gaps)
        for (uint256 i = 0; i < transfers.length; i++) {
            TransferLeg calldata t = transfers[i];
            _payFromDeposit(t.token, t.from, t.to, t.amount);
        }

        // 3) Mark obligations settled
        uint256[] memory obligationIds = clearing.getObligationIds(roundId);
        registry.markSettled(obligationIds);

        // 4) Mark round settled
        settledRounds[roundId] = true;
        clearing.markSettled(roundId);

        emit RoundSettled(
            roundId, roundHash, transfers.length, obligationIds.length, externalLiquidityUsd, externalFxUsd
        );
    }

    function _executeResidualFx(
        uint256 roundId,
        address fromToken,
        address toToken,
        uint128 fromAmount,
        uint128 toAmount
    ) internal {
        address lp = liquidityProvider == address(0) ? operator : liquidityProvider;
        // Pull sell-side liquidity from LP deposit into adapter
        uint256 fromBal = deposits[fromToken][lp];
        if (fromBal < fromAmount) revert InsufficientDeposit();
        deposits[fromToken][lp] = fromBal - fromAmount;

        if (!IERC20Minimal(fromToken).approve(stableFxAdapter, fromAmount)) revert TransferFailed();

        (bool ok, bytes memory data) = stableFxAdapter.call(
            abi.encodeWithSignature(
                "executeRfq(address,address,uint256,uint256,address)", fromToken, toToken, uint256(fromAmount), uint256(toAmount), address(this)
            )
        );
        if (!ok) {
            assembly {
                revert(add(data, 32), mload(data))
            }
        }

        // Credit received buy token to LP deposit book
        deposits[toToken][lp] += toAmount;
        emit ResidualFxExecuted(roundId, stableFxAdapter, fromAmount, toAmount);
    }

    function _payFromDeposit(address token, address from, address to, uint128 amount) internal {
        if (amount == 0) return;
        address payer = from;
        uint256 bal = deposits[token][payer];
        if (bal < amount) {
            // Fall back to LP funding the liquidity gap
            address lp = liquidityProvider == address(0) ? operator : liquidityProvider;
            uint256 need = amount - bal;
            uint256 lpBal = deposits[token][lp];
            if (lpBal < need) revert InsufficientDeposit();
            if (bal > 0) {
                deposits[token][payer] = 0;
            }
            deposits[token][lp] = lpBal - need;
        } else {
            deposits[token][payer] = bal - amount;
        }
        if (!IERC20Minimal(token).transfer(to, amount)) revert TransferFailed();
    }

    }
