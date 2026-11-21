<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/**
 * Pièce d'une dépense : le type est lu sur le contenu par Documents (jamais sur l'extension), conservation comptable.
 */
final readonly class ExpenseAttachments
{
    public function __construct(private DocumentStore $documents) {}

    public function store(UploadedFile $fichier, string $expenseId): string
    {
        $chemin = $fichier->getRealPath();

        if ($chemin === false) {
            throw ErrorCode::FileInvalid->problem();
        }

        $stocke = $this->documents->store(
            FileSource::path($chemin),
            Str::limit(basename($fichier->getClientOriginalName()), 120, ''),
            FileCategory::Supporting,
            new DocumentSubject('expense', $expenseId),
            CarbonImmutable::today()->addYears((int) config('charges.accounting_retention_years')),
        );

        return $stocke->id;
    }
}
