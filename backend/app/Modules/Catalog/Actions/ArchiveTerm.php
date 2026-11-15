<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\Queries\VisibleTerms;
use Illuminate\Support\Facades\DB;

final readonly class ArchiveTerm
{
    public function __construct(private VisibleTerms $valeurs) {}

    public function handle(Term $valeur, bool $archived): TermData
    {
        if ($valeur->isPlatform()) {
            throw ErrorCode::PlatformTermImmutable->problem();
        }

        return DB::transaction(function () use ($valeur, $archived): TermData {
            if ($archived !== ($valeur->archived_at !== null)) {
                $valeur->archived_at = $archived ? now() : null;
                $valeur->save();
            }

            return $this->valeurs->one($valeur);
        });
    }
}
