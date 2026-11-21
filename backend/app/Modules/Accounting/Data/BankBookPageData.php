<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

final readonly class BankBookPageData
{
    /**
     * @param  list<BankBookLineData>  $lines
     * @param  string|null  $nextCursor  opaque ; null quand la dernière page est atteinte
     */
    public function __construct(
        public array $lines,
        public ?string $nextCursor,
    ) {}
}
