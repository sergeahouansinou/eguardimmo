<?php

declare(strict_types=1);

namespace App\Modules\Accounting\PublicApi;

use App\Modules\Accounting\Data\LeaseStatementData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Queries\Balances;
use App\Modules\Accounting\Queries\EntryTotals;
use App\Modules\Accounting\Support\LedgerSettings;
use Carbon\CarbonImmutable;
use Money\Currency;
use Money\Money;

/**
 * Lectures du grand livre de l'organisation courante. `$asOf` : dernière date comptable incluse ; null = tout.
 */
final readonly class LedgerReader
{
    public function __construct(
        private Balances $soldes,
        private LedgerSettings $reglages,
        private EntryTotals $totaux,
    ) {}

    /**
     * Solde dans le sens normal du compte (créditeur pour une dette, débiteur pour une créance).
     */
    public function accountBalance(AccountRole $role, Currency $currency, ?CarbonImmutable $asOf = null): Money
    {
        return $this->soldes->account($role, $currency, $asOf);
    }

    public function dueByLease(string $leaseId, Currency $currency, ?CarbonImmutable $asOf = null): Money
    {
        return $this->soldes->receivable('lease_id', $leaseId, $currency, $asOf);
    }

    public function dueByParty(string $partyId, Currency $currency, ?CarbonImmutable $asOf = null): Money
    {
        return $this->soldes->receivable('party_id', $partyId, $currency, $asOf);
    }

    /**
     * Reste dû d'une créance ; négatif quand elle est trop payée.
     */
    public function outstanding(ItemType $itemType, string $itemId, Currency $currency, ?CarbonImmutable $asOf = null): Money
    {
        return $this->soldes->item($itemType, $itemId, $currency, $asOf);
    }

    /**
     * Reste à payer au prestataire sur une facture reçue (compte `SupplierPayable`, ADR 0029).
     */
    public function supplierOutstanding(string $supplierInvoiceId, Currency $currency, ?CarbonImmutable $asOf = null): Money
    {
        return $this->soldes->itemOn(AccountRole::SupplierPayable, ItemType::SupplierInvoice, $supplierInvoiceId, $currency, $asOf);
    }

    /**
     * Part d'une facture reçue pas encore imputée (compte `WorksPending`) ; nulle quand tout est imputé.
     */
    public function worksPending(string $supplierInvoiceId, Currency $currency, ?CarbonImmutable $asOf = null): Money
    {
        return $this->soldes->itemOn(AccountRole::WorksPending, ItemType::SupplierInvoice, $supplierInvoiceId, $currency, $asOf);
    }

    /**
     * Solde du dépôt de garantie d'un bail (compte `SecurityDeposits`, côté crédit).
     */
    public function depositBalance(string $leaseId, Currency $currency, ?CarbonImmutable $asOf = null): Money
    {
        return $this->soldes->accountOnLease(AccountRole::SecurityDeposits, $leaseId, $currency, $asOf);
    }

    /**
     * TVA encore en attente d'exigibilité sur une créance (compte `VatDeferred`) ; nulle quand tout est exigible.
     */
    public function deferredVat(ItemType $itemType, string $itemId, Currency $currency, ?CarbonImmutable $asOf = null): Money
    {
        return $this->soldes->deferredVat($itemType, $itemId, $currency, $asOf);
    }

    /**
     * Comme outstanding() pour plusieurs créances d'un même type, en une requête ; une créance sans écriture vaut zéro.
     *
     * @param  list<string>  $itemIds
     * @return array<string, Money> par identifiant de créance
     */
    public function outstandingMany(ItemType $itemType, array $itemIds, Currency $currency, ?CarbonImmutable $asOf = null): array
    {
        return $this->soldes->items($itemType, $itemIds, $currency, $asOf);
    }

    /**
     * Compte locataire d'un bail entre deux dates comptables incluses ; lève statement_too_long au-delà de `Balances::RELEVE_LIGNES_MAX` lignes.
     */
    public function leaseStatement(string $leaseId, Currency $currency, CarbonImmutable $from, CarbonImmutable $to): LeaseStatementData
    {
        return $this->soldes->statement($leaseId, $currency, $from, $to);
    }

    /**
     * Date d'activation du routage des loyers vers les fonds de mandants (ADR 0031) ; null tant que le rattrapage n'a pas eu lieu.
     */
    public function ownerFundsCutoverAt(): ?CarbonImmutable
    {
        return $this->reglages->ownerFundsCutoverAt();
    }

    /**
     * Solde d'un compte pour un mandant (partie des lignes), dans le sens normal du compte.
     */
    public function partyBalance(AccountRole $role, string $partyId, Currency $currency, ?CarbonImmutable $asOf = null): Money
    {
        return $this->soldes->accountOnParty($role, $partyId, $currency, $asOf);
    }

    /**
     * Reste à encaisser, par compte « appelé » (loyer, charges, TVA), d'une créance appelée pour le compte d'un mandant.
     *
     * @return array<string, Money> par rôle de compte (`owner_rent_called`…)
     */
    public function calledRemaining(ItemType $itemType, string $itemId, Currency $currency, ?CarbonImmutable $asOf = null): array
    {
        $restes = [];

        foreach ([AccountRole::OwnerRentCalled, AccountRole::OwnerChargesCalled, AccountRole::OwnerVatCalled] as $role) {
            $restes[$role->value] = $this->soldes->itemOn($role, $itemType, $itemId, $currency, $asOf);
        }

        return $restes;
    }

    /**
     * Total des débits de chaque écriture demandée (contrôle de cohérence d'un module qui comptabilise une pièce) ; une écriture inconnue est absente.
     *
     * @param  list<string>  $entryIds
     * @return array<string, int>
     */
    public function entryDebitTotals(array $entryIds): array
    {
        return $this->totaux->debits($entryIds);
    }
}
