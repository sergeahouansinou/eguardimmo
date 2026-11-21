<?php

declare(strict_types=1);

namespace App\Modules\Rent\PublicApi;

use App\Modules\Rent\Data\OwnerBackfillReportData;
use App\Modules\Rent\Support\OwnerBackfill as Backfill;

/**
 * Rattrapage des échéances d'une organisation vers les fonds des mandants (ADR 0031, décision 8).
 */
final readonly class OwnerBackfill
{
    public function __construct(private Backfill $rattrapage) {}

    public function plan(): OwnerBackfillReportData
    {
        return $this->rattrapage->plan();
    }

    public function apply(): OwnerBackfillReportData
    {
        return $this->rattrapage->apply();
    }
}
