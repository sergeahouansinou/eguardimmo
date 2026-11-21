<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Http\Requests\ListSummariesRequest;
use App\Modules\Tax\Http\Resources\SummaryResource;
use App\Modules\Tax\Queries\Summaries;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListSummariesController
{
    public function __invoke(ListSummariesRequest $requete, Summaries $syntheses): AnonymousResourceCollection
    {
        $annee = $requete->filled('income_year') ? $requete->integer('income_year') : null;

        return SummaryResource::collection($syntheses->listing(SummaryScope::Organization, $annee)->cursorPaginate($requete->perPage()));
    }
}
