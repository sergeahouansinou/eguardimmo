<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

use Money\Money;

final readonly class LeaseProvisionsData
{
    /**
     * @param  Money  $called  provisions appelées par les échéances émises et non annulées de la période
     * @param  Money  $unpaid  part de ces provisions encore due au grand livre ; elle reste une créance de loyer
     * @param  list<string>  $mandantPartyIds  mandants distincts auxquels ces échéances ont été routées
     * @param  list<string>  $mandateIds  mandats distincts de ces échéances
     * @param  bool  $hasUnrouted  au moins une de ces échéances n'est routée vers aucun mandant
     */
    public function __construct(
        public string $leaseId,
        public Money $called,
        public Money $unpaid,
        public int $installments,
        public array $mandantPartyIds,
        public array $mandateIds,
        public bool $hasUnrouted,
    ) {}
}
