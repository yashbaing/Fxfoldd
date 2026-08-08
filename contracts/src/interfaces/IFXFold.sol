// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFXFold {
    enum InvoiceCurrency {
        AED,
        USD,
        EUR
    }

    enum SettlementCurrency {
        USDC,
        EURC
    }

    enum ObligationStatus {
        Pending,
        Accepted,
        InClearing,
        Settled,
        Cancelled
    }

    enum RoundStatus {
        Proposed,
        Approving,
        Approved,
        Settled,
        Cancelled
    }

    struct Obligation {
        bytes32 invoiceId;
        address debtor;
        address creditor;
        uint256 amount; // 6 decimals, invoice denomination
        InvoiceCurrency invoiceCurrency;
        SettlementCurrency settlementCurrency;
        uint256 dueDate;
        ObligationStatus status;
        bool debtorAccepted;
        bool creditorAccepted;
    }

    struct NetPosition {
        address participant;
        SettlementCurrency currency;
        int256 amount; // positive = receives, negative = pays
    }

    struct InternalFXMatch {
        address participantA;
        address participantB;
        SettlementCurrency currencyA;
        SettlementCurrency currencyB;
        uint256 amountA;
        uint256 amountB;
    }

    struct ExternalFXLeg {
        SettlementCurrency sellCurrency;
        SettlementCurrency buyCurrency;
        uint256 sellAmount;
        uint256 buyAmount;
    }
}
