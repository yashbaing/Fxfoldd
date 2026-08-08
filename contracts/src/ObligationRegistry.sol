// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ObligationRegistry
 * @notice Stores bilaterally accepted trade obligations for FXFold clearing.
 *         Invoice currency (AED/USD/EUR) is separated from settlement currency (USDC/EURC).
 */
contract ObligationRegistry {
    enum Status {
        None,
        Proposed,
        Accepted,
        IncludedInRound,
        Settled,
        Cancelled
    }

    struct Obligation {
        bytes32 invoiceId;
        address debtor;
        address creditor;
        uint128 amount; // 6-decimal units in invoice currency
        bytes32 invoiceCurrency; // keccak256("AED"|"USD"|"EUR")
        bytes32 settlementCurrency; // keccak256("USDC"|"EURC")
        uint64 dueDate;
        Status status;
        bool debtorAccepted;
        bool creditorAccepted;
    }

    address public operator;
    address public settlement;
    uint256 public nextId;

    mapping(uint256 => Obligation) public obligations;
    mapping(bytes32 => uint256) public invoiceToId;

    event ObligationProposed(
        uint256 indexed id,
        bytes32 indexed invoiceId,
        address indexed debtor,
        address creditor,
        uint128 amount,
        bytes32 invoiceCurrency,
        bytes32 settlementCurrency
    );
    event ObligationAccepted(uint256 indexed id, address indexed party);
    event ObligationFullyAccepted(uint256 indexed id);
    event ObligationStatusChanged(uint256 indexed id, Status status);
    event OperatorUpdated(address indexed operator);
    event SettlementUpdated(address indexed settlement);

    error NotOperator();
    error NotSettlement();
    error NotParty();
    error InvalidParties();
    error InvalidAmount();
    error DuplicateInvoice();
    error BadStatus();
    error AlreadyAccepted();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    modifier onlySettlementOrOperator() {
        if (msg.sender != settlement && msg.sender != operator) revert NotSettlement();
        _;
    }

    constructor(address operator_) {
        operator = operator_;
        nextId = 1;
    }

    function setOperator(address operator_) external onlyOperator {
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setSettlement(address settlement_) external onlyOperator {
        settlement = settlement_;
        emit SettlementUpdated(settlement_);
    }

    function proposeObligation(
        bytes32 invoiceId,
        address debtor,
        address creditor,
        uint128 amount,
        bytes32 invoiceCurrency,
        bytes32 settlementCurrency,
        uint64 dueDate
    ) external returns (uint256 id) {
        if (debtor == address(0) || creditor == address(0) || debtor == creditor) revert InvalidParties();
        if (amount == 0) revert InvalidAmount();
        if (invoiceToId[invoiceId] != 0) revert DuplicateInvoice();
        if (msg.sender != debtor && msg.sender != creditor && msg.sender != operator) revert NotParty();

        id = nextId++;
        Obligation storage o = obligations[id];
        o.invoiceId = invoiceId;
        o.debtor = debtor;
        o.creditor = creditor;
        o.amount = amount;
        o.invoiceCurrency = invoiceCurrency;
        o.settlementCurrency = settlementCurrency;
        o.dueDate = dueDate;
        o.status = Status.Proposed;

        if (msg.sender == debtor || msg.sender == operator) {
            o.debtorAccepted = true;
        }
        if (msg.sender == creditor || msg.sender == operator) {
            o.creditorAccepted = true;
        }

        invoiceToId[invoiceId] = id;
        emit ObligationProposed(id, invoiceId, debtor, creditor, amount, invoiceCurrency, settlementCurrency);

        if (o.debtorAccepted) emit ObligationAccepted(id, debtor);
        if (o.creditorAccepted) emit ObligationAccepted(id, creditor);

        if (o.debtorAccepted && o.creditorAccepted) {
            o.status = Status.Accepted;
            emit ObligationFullyAccepted(id);
        }
    }

    function acceptObligation(uint256 id) external {
        Obligation storage o = obligations[id];
        if (o.status != Status.Proposed && o.status != Status.Accepted) revert BadStatus();
        if (msg.sender != o.debtor && msg.sender != o.creditor) revert NotParty();

        if (msg.sender == o.debtor) {
            if (o.debtorAccepted) revert AlreadyAccepted();
            o.debtorAccepted = true;
        } else {
            if (o.creditorAccepted) revert AlreadyAccepted();
            o.creditorAccepted = true;
        }

        emit ObligationAccepted(id, msg.sender);

        if (o.debtorAccepted && o.creditorAccepted) {
            o.status = Status.Accepted;
            emit ObligationFullyAccepted(id);
        }
    }

    /// @notice Operator can mark demo invoices as bilaterally accepted.
    function forceAccept(uint256 id) external onlyOperator {
        Obligation storage o = obligations[id];
        if (o.status != Status.Proposed && o.status != Status.Accepted) revert BadStatus();
        o.debtorAccepted = true;
        o.creditorAccepted = true;
        o.status = Status.Accepted;
        emit ObligationFullyAccepted(id);
    }

    function markIncluded(uint256[] calldata ids) external onlyOperator {
        for (uint256 i = 0; i < ids.length; i++) {
            Obligation storage o = obligations[ids[i]];
            if (o.status != Status.Accepted) revert BadStatus();
            o.status = Status.IncludedInRound;
            emit ObligationStatusChanged(ids[i], Status.IncludedInRound);
        }
    }

    function markSettled(uint256[] calldata ids) external onlySettlementOrOperator {
        for (uint256 i = 0; i < ids.length; i++) {
            Obligation storage o = obligations[ids[i]];
            if (o.status != Status.IncludedInRound && o.status != Status.Accepted) revert BadStatus();
            o.status = Status.Settled;
            emit ObligationStatusChanged(ids[i], Status.Settled);
        }
    }

    function getObligation(uint256 id) external view returns (Obligation memory) {
        return obligations[id];
    }

    function isAccepted(uint256 id) external view returns (bool) {
        Obligation storage o = obligations[id];
        return o.status == Status.Accepted || o.status == Status.IncludedInRound || o.status == Status.Settled;
    }
}
