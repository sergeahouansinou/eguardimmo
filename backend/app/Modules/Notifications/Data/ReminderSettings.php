<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\ReminderCode;
use Carbon\CarbonImmutable;

/**
 * Réglage effectif d'un rappel : la ligne enregistrée, sinon les valeurs du catalogue.
 */
final readonly class ReminderSettings
{
    /**
     * @param  list<NotificationChannel>  $channels
     */
    public function __construct(
        public ReminderCode $code,
        public bool $enabled,
        public int $delayDays,
        public ?int $repeatEveryDays,
        public int $maxOccurrences,
        public array $channels,
        public ?CarbonImmutable $lastRunAt = null,
        public ?int $lastSentCount = null,
        public ?CarbonImmutable $updatedAt = null,
    ) {}
}
