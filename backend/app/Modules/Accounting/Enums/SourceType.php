<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Enums;

enum SourceType: string
{
    case Installment = 'installment';
    case Payment = 'payment';
    case Invoice = 'invoice';
    case CreditNote = 'credit_note';
    case Deposit = 'deposit';
    case RecoveryFee = 'recovery_fee';
    case Adjustment = 'adjustment';
    case JournalEntry = 'journal_entry';
    case SupplierInvoice = 'supplier_invoice';
    case SupplierAllocation = 'supplier_allocation';
    case SupplierPayment = 'supplier_payment';
    case OwnerPayout = 'owner_payout';
    case FeeSettlement = 'fee_settlement';
    case TrustTransfer = 'trust_transfer';
    case Expense = 'expense';
    case ChargeStatement = 'charge_statement';
    case BankLine = 'bank_line';
}
