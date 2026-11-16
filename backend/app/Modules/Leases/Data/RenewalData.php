<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class RenewalData
{
    /**
     * @param  int|null  $durationMonths  durée de la prolongation ; absente : reconduction du régime, sinon durée du bail
     * @param  list<array{component_term_id: string, amount: ?int, vat_bp: ?int, indexed: ?bool, close: bool}>  $changes  composantes révisées à la date du renouvellement
     */
    public function __construct(
        public int $lockVersion,
        public ?int $durationMonths,
        public array $changes,
    ) {}
}
