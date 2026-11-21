<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class TerminateMandateData
{
    /**
     * @param  string  $effectiveOn  dernier jour du mandat, inclus (Y-m-d)
     */
    public function __construct(
        public int $lockVersion,
        public string $noticeGivenOn,
        public string $effectiveOn,
        public string $reason,
        public bool $amicable,
        public ?string $note,
    ) {}
}
