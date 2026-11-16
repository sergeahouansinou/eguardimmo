<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Enums\TermChangeReason;

final readonly class TermRevisionData
{
    /**
     * @param  string  $effectiveOn  Y-m-d, premier jour des nouvelles lignes
     * @param  list<array{component_term_id: string, amount: ?int, vat_bp: ?int, indexed: ?bool, close: bool}>  $changes  montants en unités mineures, dans la devise du bail
     */
    public function __construct(
        public int $leaseVersion,
        public string $effectiveOn,
        public TermChangeReason $reason,
        public array $changes,
    ) {}
}
