// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IFXFold} from "./interfaces/IFXFold.sol";

/// @title ObligationRegistry
/// @notice Stores bilateral trade obligations accepted by debtor and creditor via EIP-712 signatures.
contract ObligationRegistry is IFXFold, EIP712, Ownable {
    using ECDSA for bytes32;

    bytes32 public constant OBLIGATION_TYPEHASH = keccak256(
        "Obligation(bytes32 invoiceId,address debtor,address creditor,uint256 amount,uint8 invoiceCurrency,uint8 settlementCurrency,uint256 dueDate)"
    );

    uint256 public obligationCount;
    mapping(bytes32 => Obligation) public obligations;
    mapping(bytes32 => bool) public invoiceExists;
    bytes32[] public obligationIds;

    event ObligationCreated(bytes32 indexed obligationId, bytes32 invoiceId, address debtor, address creditor);
    event ObligationAccepted(bytes32 indexed obligationId, address indexed acceptor, bool isDebtor);
    event ObligationStatusChanged(bytes32 indexed obligationId, ObligationStatus status);

    constructor(address owner_) EIP712("FXFold", "1") Ownable(owner_) {}

    function createObligation(
        bytes32 invoiceId,
        address debtor,
        address creditor,
        uint256 amount,
        InvoiceCurrency invoiceCurrency,
        SettlementCurrency settlementCurrency,
        uint256 dueDate
    ) external returns (bytes32 obligationId) {
        require(debtor != address(0) && creditor != address(0), "Invalid parties");
        require(debtor != creditor, "Self obligation");
        require(amount > 0, "Zero amount");
        require(!invoiceExists[invoiceId], "Invoice exists");

        obligationId = keccak256(abi.encodePacked(invoiceId, debtor, creditor, block.timestamp, obligationCount));
        obligationCount++;

        obligations[obligationId] = Obligation({
            invoiceId: invoiceId,
            debtor: debtor,
            creditor: creditor,
            amount: amount,
            invoiceCurrency: invoiceCurrency,
            settlementCurrency: settlementCurrency,
            dueDate: dueDate,
            status: ObligationStatus.Pending,
            debtorAccepted: false,
            creditorAccepted: false
        });

        invoiceExists[invoiceId] = true;
        obligationIds.push(obligationId);

        emit ObligationCreated(obligationId, invoiceId, debtor, creditor);
    }

    function acceptObligation(bytes32 obligationId, bytes calldata signature) external {
        Obligation storage ob = obligations[obligationId];
        require(ob.amount > 0, "Not found");
        require(ob.status == ObligationStatus.Pending, "Not pending");

        address signer = _recoverObligationSigner(ob, signature);
        require(signer == ob.debtor || signer == ob.creditor, "Invalid signer");

        if (signer == ob.debtor) {
            require(!ob.debtorAccepted, "Debtor accepted");
            ob.debtorAccepted = true;
            emit ObligationAccepted(obligationId, signer, true);
        } else {
            require(!ob.creditorAccepted, "Creditor accepted");
            ob.creditorAccepted = true;
            emit ObligationAccepted(obligationId, signer, false);
        }

        if (ob.debtorAccepted && ob.creditorAccepted) {
            ob.status = ObligationStatus.Accepted;
            emit ObligationStatusChanged(obligationId, ObligationStatus.Accepted);
        }
    }

    function markInClearing(bytes32[] calldata ids) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            Obligation storage ob = obligations[ids[i]];
            require(ob.status == ObligationStatus.Accepted, "Not accepted");
            ob.status = ObligationStatus.InClearing;
            emit ObligationStatusChanged(ids[i], ObligationStatus.InClearing);
        }
    }

    function markSettled(bytes32[] calldata ids) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            Obligation storage ob = obligations[ids[i]];
            require(ob.status == ObligationStatus.InClearing, "Not in clearing");
            ob.status = ObligationStatus.Settled;
            emit ObligationStatusChanged(ids[i], ObligationStatus.Settled);
        }
    }

    function getAcceptedObligationIds() external view returns (bytes32[] memory ids) {
        uint256 count;
        for (uint256 i = 0; i < obligationIds.length; i++) {
            if (obligations[obligationIds[i]].status == ObligationStatus.Accepted) {
                count++;
            }
        }
        ids = new bytes32[](count);
        uint256 j;
        for (uint256 i = 0; i < obligationIds.length; i++) {
            if (obligations[obligationIds[i]].status == ObligationStatus.Accepted) {
                ids[j++] = obligationIds[i];
            }
        }
    }

    function getObligationDigest(bytes32 obligationId) external view returns (bytes32) {
        return _hashObligation(obligations[obligationId]);
    }

    function _recoverObligationSigner(Obligation storage ob, bytes calldata signature) internal view returns (address) {
        bytes32 digest = _hashObligation(ob);
        return digest.recover(signature);
    }

    function _hashObligation(Obligation storage ob) internal view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    OBLIGATION_TYPEHASH,
                    ob.invoiceId,
                    ob.debtor,
                    ob.creditor,
                    ob.amount,
                    uint8(ob.invoiceCurrency),
                    uint8(ob.settlementCurrency),
                    ob.dueDate
                )
            )
        );
    }
}
