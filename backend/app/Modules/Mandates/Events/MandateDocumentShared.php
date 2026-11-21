<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Une pièce du mandat est partagée avec le mandant. Ni nom de fichier ni libellé : des identifiants.
 */
final readonly class MandateDocumentShared implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $documentId,
        public string $mandateId,
        public string $organizationId,
        public string $mandantPartyId,
    ) {}
}
