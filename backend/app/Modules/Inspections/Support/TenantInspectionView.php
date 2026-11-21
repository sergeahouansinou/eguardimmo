<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Support;

use App\Modules\Inspections\Enums\RemarkKind;
use App\Modules\Inspections\Models\Inspection;

final readonly class TenantInspectionView
{
    /**
     * @param  list<RemarkKind>  $openRemarkKinds
     */
    public function __construct(
        public Inspection $inspection,
        public array $openRemarkKinds,
    ) {}
}
