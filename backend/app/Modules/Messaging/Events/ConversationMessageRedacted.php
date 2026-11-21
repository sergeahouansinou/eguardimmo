<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * L'organisation a retiré le message d'un autre compte ; ni texte ni motif (ADR 0033, amendement du 19 novembre 2026).
 * Un retrait par l'auteur lui-même ne produit pas d'événement.
 */
final readonly class ConversationMessageRedacted implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    /**
     * @param  'staff'|'tenant'|'owner'  $authorSide
     */
    public function __construct(
        public string $organizationId,
        public string $conversationId,
        public string $messageId,
        public string $authorSide,
        public string $authorUserId,
        public ?string $partyId,
        public ?string $leaseId,
    ) {}
}
