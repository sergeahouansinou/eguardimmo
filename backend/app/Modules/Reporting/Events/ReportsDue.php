<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Un mandat couvre la période échue sans qu'aucun compte rendu de gestion ne la couvre.
 */
final readonly class ReportsDue implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $organizationId,
        public string $mandantPartyId,
        public string $periodStart,
        public string $periodEnd,
    ) {}
}
