<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Enums;

enum AccountRole: string
{
    case Bank = 'bank';
    case Cash = 'cash';
    case TenantReceivable = 'tenant_receivable';
    case OwnerPayable = 'owner_payable';
    case SecurityDeposits = 'security_deposits';
    case VatCollected = 'vat_collected';
    case RentRevenue = 'rent_revenue';
    case ChargesRecovered = 'charges_recovered';
    case FeeRevenue = 'fee_revenue';
    case CollectionFees = 'collection_fees';
    case Expenses = 'expenses';

    public function normalSide(): Side
    {
        return match ($this) {
            self::Bank, self::Cash, self::TenantReceivable, self::Expenses => Side::Debit,
            self::OwnerPayable, self::SecurityDeposits, self::VatCollected, self::RentRevenue,
            self::ChargesRecovered, self::FeeRevenue, self::CollectionFees => Side::Credit,
        };
    }

    public function defaultCode(): string
    {
        return match ($this) {
            self::Bank => '1000',
            self::Cash => '1100',
            self::TenantReceivable => '2000',
            self::OwnerPayable => '3000',
            self::SecurityDeposits => '3100',
            self::VatCollected => '3200',
            self::RentRevenue => '4000',
            self::ChargesRecovered => '4100',
            self::FeeRevenue => '4200',
            self::CollectionFees => '4300',
            self::Expenses => '5000',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Bank => 'Banque',
            self::Cash => 'Caisse',
            self::TenantReceivable => 'Créances locataires',
            self::OwnerPayable => 'Dettes envers les propriétaires et mandants',
            self::SecurityDeposits => 'Dépôts de garantie reçus',
            self::VatCollected => 'TVA collectée',
            self::RentRevenue => 'Produits de loyers',
            self::ChargesRecovered => 'Charges récupérées',
            self::FeeRevenue => 'Honoraires',
            self::CollectionFees => 'Frais de recouvrement',
            self::Expenses => 'Charges',
        };
    }
}
