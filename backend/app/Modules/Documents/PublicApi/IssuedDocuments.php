<?php

declare(strict_types=1);

namespace App\Modules\Documents\PublicApi;

use App\Modules\Documents\Actions\IssueDocument;
use App\Modules\Documents\Data\IssuedDocumentData;
use App\Modules\Documents\Data\NewIssuedDocumentData;

/**
 * Pièces émises (ADR 0022). Le PDF est produit et scellé en amont : Documents stocke ce qu'il reçoit.
 */
final readonly class IssuedDocuments
{
    public function __construct(private IssueDocument $emission) {}

    /**
     * À appeler dans la transaction de l'appelant : le numéro (continu par organisation et par type) est pris sous verrou,
     * puis l'instantané et l'empreinte du PDF sont figés.
     */
    public function issue(NewIssuedDocumentData $data): IssuedDocumentData
    {
        return $this->emission->handle($data);
    }
}
