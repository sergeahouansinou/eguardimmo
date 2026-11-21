<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Http\Requests\ListSummariesRequest;
use App\Modules\Tax\Http\Resources\SummaryResource;
use App\Modules\Tax\Queries\Summaries;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListMandantStatementsController
{
    public function __invoke(ListSummariesRequest $requete, Summaries $syntheses): AnonymousResourceCollection
    {
        $annee = $requete->filled('income_year') ? $requete->integer('income_year') : null;
        $mandant = $requete->filled('mandant') ? $requete->string('mandant')->toString() : null;

        return SummaryResource::collection($syntheses->listing(SummaryScope::Mandant, $annee, $mandant)->cursorPaginate($requete->perPage()));
    }
}
