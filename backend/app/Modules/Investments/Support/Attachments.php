<?php

declare(strict_types=1);

namespace App\Modules\Investments\Support;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Investments\Enums\ErrorCode;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/**
 * Offre, attestation, acte : le type est lu sur le contenu par Documents (jamais sur l'extension).
 */
final readonly class Attachments
{
    public function __construct(private DocumentStore $documents) {}

    public function store(UploadedFile $fichier, string $subjectType, string $subjectId): string
    {
        $chemin = $fichier->getRealPath();

        if ($chemin === false) {
            throw ErrorCode::FileInvalid->problem();
        }

        return $this->documents->store(
            FileSource::path($chemin),
            Str::limit(basename($fichier->getClientOriginalName()), 120, ''),
            FileCategory::Supporting,
            new DocumentSubject($subjectType, $subjectId),
            CarbonImmutable::today()->addYears((int) config('investments.accounting_retention_years')),
        )->id;
    }
}
