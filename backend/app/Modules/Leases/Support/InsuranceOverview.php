<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Documents\Data\CoverageData;
use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use Illuminate\Database\Eloquent\Collection;

/**
 * Couverture d'assurance d'un bail et dépôts à montrer à celui qui la consulte.
 */
final readonly class InsuranceOverview
{
    /**
     * @param  Collection<int, LeaseInsuranceSubmission>  $submissions
     */
    public function __construct(
        public CoverageData $coverage,
        public Collection $submissions,
    ) {}
}
