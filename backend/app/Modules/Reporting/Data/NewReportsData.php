<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Data;

use App\Modules\Reporting\Enums\PeriodKind;

final readonly class NewReportsData
{
    /**
     * @param  list<string>  $mandantIds
     * @param  list<string>  $sections
     * @param  array{letterhead: bool, reminder_detail: bool, receipts_attached: bool}  $options
     */
    public function __construct(
        public PeriodKind $kind,
        public string $from,
        public string $to,
        public array $mandantIds,
        public array $sections,
        public array $options,
        public bool $generate,
        public bool $notify,
    ) {}
}
