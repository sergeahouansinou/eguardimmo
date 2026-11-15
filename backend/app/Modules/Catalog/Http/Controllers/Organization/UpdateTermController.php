<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Controllers\Organization;

use App\Modules\Catalog\Actions\UpdateTerm;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Http\Requests\UpdateTermRequest;
use App\Modules\Catalog\Http\Resources\TermResource;
use App\Modules\Catalog\Queries\VisibleTerms;

final class UpdateTermController
{
    public function __invoke(UpdateTermRequest $request, string $term, VisibleTerms $valeurs, UpdateTerm $modifier): TermResource
    {
        $valeur = $valeurs->get($term) ?? throw ErrorCode::TermNotFound->problem();

        return new TermResource($modifier->handle($valeur, $request->labels(), $request->metadata()));
    }
}
