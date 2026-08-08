// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";

/**
 * @title StableFXAdapter
 * @notice Demo RFQ adapter for residual FX after FXFold compression.
 *         Labeled as a demo adapter — swap for live Circle StableFX when credentials exist.
 *
 * Positioning: StableFX optimizes FX execution. FXFold reduces how much FX needs to happen.
 */
contract StableFXAdapter {
    address public operator;
    bool public constant IS_DEMO_ADAPTER = true;

    event RfqQuoted(
        address indexed fromToken,
        address indexed toToken,
        uint256 fromAmount,
        uint256 toAmount,
        uint256 timestamp
    );
    event RfqExecuted(
        address indexed fromToken,
        address indexed toToken,
        uint256 fromAmount,
        uint256 toAmount,
        address indexed recipient
    );

    error NotOperator();
    error TransferFailed();
    error InsufficientLiquidity();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address operator_) {
        operator = operator_;
    }

    function setOperator(address operator_) external onlyOperator {
        operator = operator_;
    }

    /// @notice Seed the adapter with settlement tokens for demo residual swaps.
    function seedLiquidity(address token, uint256 amount) external {
        if (!IERC20Minimal(token).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
    }

    function quote(address, address, uint256 fromAmount) external view returns (uint256 toAmount) {
        // 1:1 demo quote for USDC/EURC residual (hackathon simplification)
        toAmount = fromAmount;
    }

    function executeRfq(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount,
        address recipient
    ) external returns (uint256) {
        if (!IERC20Minimal(fromToken).transferFrom(msg.sender, address(this), fromAmount)) revert TransferFailed();
        if (IERC20Minimal(toToken).balanceOf(address(this)) < toAmount) revert InsufficientLiquidity();
        if (!IERC20Minimal(toToken).transfer(recipient, toAmount)) revert TransferFailed();
        emit RfqExecuted(fromToken, toToken, fromAmount, toAmount, recipient);
        return toAmount;
    }
}
