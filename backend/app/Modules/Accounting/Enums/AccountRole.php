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
    case CustomerReceivable = 'customer_receivable';
    case VatDeferred = 'vat_deferred';
    case SupplierPayable = 'supplier_payable';
    case WorksPending = 'works_pending';
    case TrustBank = 'trust_bank';
    case OwnerRentCalled = 'owner_rent_called';
    case OwnerChargesCalled = 'owner_charges_called';
    case OwnerVatCalled = 'owner_vat_called';
    case PayoutsInTransit = 'payouts_in_transit';
    case BankCharges = 'bank_charges';

    public function normalSide(): Side
    {
        return match ($this) {
            self::Bank, self::TrustBank, self::Cash, self::TenantReceivable, self::CustomerReceivable, self::WorksPending, self::Expenses, self::BankCharges => Side::Debit,
            self::OwnerPayable, self::SecurityDeposits, self::VatCollected, self::VatDeferred, self::SupplierPayable, self::RentRevenue,
            self::ChargesRecovered, self::FeeRevenue, self::CollectionFees, self::OwnerRentCalled, self::OwnerChargesCalled, self::OwnerVatCalled, self::PayoutsInTransit => Side::Credit,
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
            self::CustomerReceivable => '2100',
            self::VatDeferred => '3210',
            self::SupplierPayable => '2200',
            self::WorksPending => '2300',
            self::TrustBank => '1010',
            self::OwnerRentCalled => '3010',
            self::OwnerChargesCalled => '3020',
            self::OwnerVatCalled => '3030',
            self::PayoutsInTransit => '3300',
            self::BankCharges => '5100',
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
            self::CustomerReceivable => 'Clients',
            self::VatDeferred => 'TVA collectée à exigibilité différée',
            self::SupplierPayable => 'Fournisseurs',
            self::WorksPending => 'Travaux à imputer',
            self::TrustBank => 'Banque, compte de tiers (fonds des mandants)',
            self::OwnerRentCalled => 'Loyers appelés pour le compte des mandants, non encaissés',
            self::OwnerChargesCalled => 'Charges appelées pour le compte des mandants, non encaissées',
            self::OwnerVatCalled => 'TVA appelée pour le compte des mandants, non encaissée',
            self::PayoutsInTransit => 'Reversements validés, non exécutés',
            self::BankCharges => 'Frais bancaires',
        };
    }
}
