<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Le support a répondu au demandeur ; jamais le texte (ADR 0033). `readMarker` est la dernière lecture du demandeur (`never` sans
 * lecture) : la clé de coalescence de la notification en dépend, une seule notification tant qu'il n'a pas lu.
 */
final readonly class SupportTicketReplied implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $ticketId,
        public string $requesterUserId,
        public string $readMarker,
    ) {}
}
