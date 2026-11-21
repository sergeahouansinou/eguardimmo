<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

use Carbon\CarbonImmutable;

final readonly class MailHealthData
{
    public function __construct(
        public bool $configured,
        public ?CarbonImmutable $lastEventAt,
        public int $bounces24h,
    ) {}
}
