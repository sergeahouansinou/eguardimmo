<?php

declare(strict_types=1);

namespace App\Modules\Planning\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Rappel d'une occurrence d'événement, à destination du créateur et des membres participants.
 */
final readonly class EventReminderDue implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    /**
     * @param  list<string>  $recipientUserIds  créateur et participants membres, sans doublon
     */
    public function __construct(
        public string $eventId,
        public string $organizationId,
        public string $occurrenceOn,
        public array $recipientUserIds,
    ) {}
}
