<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class DocumentSequence
{
    public function __construct(
        private CurrentOrganization $organisation,
        private ContinuousCounter $compteur,
    ) {}

    /**
     * Séquence continue par organisation et par type ; à appeler dans la transaction qui écrit la pièce, le verrou y reste tenu.
     */
    public function next(IssuedDocumentType $type): int
    {
        return $this->compteur->next('document_sequences', ['organization_id' => $this->organisation->id(), 'type' => $type->value]);
    }
}
