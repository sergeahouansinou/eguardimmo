<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\ArchiveTerm;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Http\Resources\TermResource;
use App\Modules\Catalog\Queries\VisibleTerms;

final class RestoreTermController
{
    public function __invoke(string $term, VisibleTerms $valeurs, ArchiveTerm $archiver): TermResource
    {
        $valeur = $valeurs->get($term) ?? throw ErrorCode::TermNotFound->problem();

        return new TermResource($archiver->handle($valeur, false));
    }
}
