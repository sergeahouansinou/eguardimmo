<?php

declare(strict_types=1);

namespace App\Modules\Documents\Enums;

enum IssuedDocumentType: string
{
    case RentReceipt = 'rent_receipt';
    case PaymentReceipt = 'payment_receipt';
    case RentNotice = 'rent_notice';
    case Invoice = 'invoice';
    case CreditNote = 'credit_note';
    case DepositStatement = 'deposit_statement';
    case ChargesRegularization = 'charges_regularization';
    case ManagementReport = 'management_report';
    case DebtStatement = 'debt_statement';
    case Attestation = 'attestation';
    case Letter = 'letter';

    public function prefix(): string
    {
        return match ($this) {
            self::RentReceipt => 'QUI',
            self::PaymentReceipt => 'REC',
            self::RentNotice => 'AVI',
            self::Invoice => 'FAC',
            self::CreditNote => 'AVO',
            self::DepositStatement => 'DEP',
            self::ChargesRegularization => 'REG',
            self::ManagementReport => 'CRG',
            self::DebtStatement => 'DEC',
            self::Attestation => 'ATT',
            self::Letter => 'COU',
        };
    }

    public function number(int $sequence): string
    {
        return sprintf('%s-%06d', $this->prefix(), $sequence);
    }
}
