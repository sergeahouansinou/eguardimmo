<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Un message vient d'être écrit dans un fil avec une contrepartie ; jamais le texte (ADR 0033). `readMarkers` donne, par compte
 * participant, l'horodatage de sa dernière lecture : la clé de coalescence des notifications en dépend.
 */
final readonly class ConversationMessagePosted implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    /**
     * @param  'tenant'|'owner'  $kind
     * @param  'staff'|'tenant'|'owner'  $authorSide
     * @param  array<string, string>  $readMarkers  dernière lecture par compte, `never` sans lecture
     */
    public function __construct(
        public string $organizationId,
        public string $conversationId,
        public string $messageId,
        public string $kind,
        public string $authorSide,
        public string $authorUserId,
        public string $partyId,
        public ?string $leaseId,
        public ?string $assigneeUserId,
        public array $readMarkers,
    ) {}
}
