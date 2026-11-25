<?php

declare(strict_types=1);

namespace App\Shared\Reminders;

use Carbon\CarbonImmutable;

/**
 * Bornes incluses de la date de départ d'un rappel.
 */
final readonly class ReminderWindow
{
    public function __construct(
        public CarbonImmutable $from,
        public CarbonImmutable $to,
    ) {}
}
