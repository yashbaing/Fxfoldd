// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IFXFold} from "./interfaces/IFXFold.sol";

/// @title StableFXAdapter
/// @notice Demo adapter for residual FX execution. Swap USDC <-> EURC at a fixed demo rate.
///         Production would integrate Circle StableFX RFQ via FxEscrow.
contract StableFXAdapter is IFXFold, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IERC20 public immutable eurc;

    // Demo rate: 1 EURC = 1.08 USDC (6 decimals)
    uint256 public constant RATE_NUMERATOR = 108;
    uint256 public constant RATE_DENOMINATOR = 100;

    event ResidualFxExecuted(
        SettlementCurrency sellCurrency,
        SettlementCurrency buyCurrency,
        uint256 sellAmount,
        uint256 buyAmount,
        address indexed executor
    );

    constructor(address owner_, address usdc_, address eurc_) Ownable(owner_) {
        usdc = IERC20(usdc_);
        eurc = IERC20(eurc_);
    }

    /// @notice Execute residual FX leg. Caller provides sell token; receives buy token from adapter liquidity.
    function executeResidualFx(
        SettlementCurrency sellCurrency,
        SettlementCurrency buyCurrency,
        uint256 sellAmount
    ) external returns (uint256 buyAmount) {
        require(sellCurrency != buyCurrency, "Same currency");
        require(sellAmount > 0, "Zero amount");

        IERC20 sellToken = sellCurrency == SettlementCurrency.USDC ? usdc : eurc;
        IERC20 buyToken = buyCurrency == SettlementCurrency.USDC ? usdc : eurc;

        sellToken.safeTransferFrom(msg.sender, address(this), sellAmount);

        if (sellCurrency == SettlementCurrency.USDC && buyCurrency == SettlementCurrency.EURC) {
            buyAmount = (sellAmount * RATE_DENOMINATOR) / RATE_NUMERATOR;
        } else {
            buyAmount = (sellAmount * RATE_NUMERATOR) / RATE_DENOMINATOR;
        }

        require(buyToken.balanceOf(address(this)) >= buyAmount, "Insufficient adapter liquidity");
        buyToken.safeTransfer(msg.sender, buyAmount);

        emit ResidualFxExecuted(sellCurrency, buyCurrency, sellAmount, buyAmount, msg.sender);
    }

    function fundLiquidity(SettlementCurrency currency, uint256 amount) external onlyOwner {
        IERC20 token = currency == SettlementCurrency.USDC ? usdc : eurc;
        token.safeTransferFrom(msg.sender, address(this), amount);
    }
}
