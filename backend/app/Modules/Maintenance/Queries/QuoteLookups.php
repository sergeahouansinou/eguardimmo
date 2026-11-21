<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;

/**
 * Interventions et accords lus une fois pour toute une page de devis.
 */
final readonly class QuoteLookups
{
    /**
     * @param  array<string, Intervention>  $interventions
     * @param  array<string, InterventionApproval>  $approvals  dernier accord par identifiant de devis
     */
    public function __construct(
        public array $interventions,
        public array $approvals,
    ) {}
}
