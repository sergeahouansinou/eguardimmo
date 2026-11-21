<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

final readonly class OwnerBackfillReportData
{
    /**
     * @param  list<OwnerBackfillItemData>  $items  échéances à reclasser (ou reclassées, après application)
     * @param  list<string>  $unmapped  échéances émises sur un lot sans mandat à `period_start` : jamais attribuées par défaut
     */
    public function __construct(
        public array $items,
        public array $unmapped,
    ) {}
}
