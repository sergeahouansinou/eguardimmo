<?php

declare(strict_types=1);

namespace App\Modules\Accounting\PublicApi;

use App\Modules\Accounting\Data\LeaseStatementData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Queries\Balances;
use Carbon\CarbonImmutable;
use Money\Currency;
use Money\Money;

/**
 * Lectures du grand livre de l'organisation courante. `$asOf` : dernière date comptable incluse ; null = tout.
 */
final readonly class LedgerReader
{
    public function __construct(private Balances $soldes) {}

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
     * Compte locataire d'un bail entre deux dates comptables incluses.
     */
    public function leaseStatement(string $leaseId, Currency $currency, CarbonImmutable $from, CarbonImmutable $to): LeaseStatementData
    {
        return $this->soldes->statement($leaseId, $currency, $from, $to);
    }
}
