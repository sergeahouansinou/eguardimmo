<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\OverrideTerm;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Http\Requests\OverrideTermRequest;
use App\Modules\Catalog\Http\Resources\TermResource;
use App\Modules\Catalog\Queries\VisibleTerms;

final class OverrideTermController
{
    public function __invoke(OverrideTermRequest $request, string $term, VisibleTerms $valeurs, OverrideTerm $surcharger): TermResource
    {
        $valeur = $valeurs->get($term) ?? throw ErrorCode::TermNotFound->problem();

        return new TermResource($surcharger->handle($valeur, $request->labels(), $request->boolean('hidden'), $request->position()));
    }
}
