<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Support;

use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Documents\Enums\ErrorCode as DocumentsError;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Models\Mandate;

/**
 * Un fichier ne se partage ni ne sert de preuve que s'il a été téléversé pour ce mandat et que l'analyse antivirale l'a déclaré sain.
 */
final readonly class MandateFileGuard
{
    public function __construct(private DocumentStore $fichiers) {}

    /**
     * @param  list<FileCategory>  $categories
     */
    public function assertDepositedFor(Mandate $mandat, string $fichierId, array $categories, ErrorCode $refus): StoredFileData
    {
        $fichier = $this->fichiers->find($fichierId)
            ?? throw $refus->problem('Ce fichier n\'existe pas dans votre organisation.');

        $pourCeMandat = $fichier->subject?->type === 'mandate' && $fichier->subject->id === $mandat->id
            && in_array($fichier->category, $categories, true);

        if (! $pourCeMandat) {
            throw $refus->problem();
        }

        if (! $fichier->scanStatus->isReadable()) {
            throw DocumentsError::DocumentNotClean->problem();
        }

        return $fichier;
    }
}
