<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Http\Requests\ListSuggestionsRequest;
use App\Modules\Banking\Http\Resources\BankSuggestionResource;
use App\Modules\Banking\Models\BankSuggestion;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListSuggestionsController
{
    public function __invoke(ListSuggestionsRequest $request): AnonymousResourceCollection
    {
        $propositions = BankSuggestion::query()->whereIn('statement_line_id', array_map('strval', $request->validated('line_ids')))->orderByDesc('score')->orderBy('id')->get();

        return BankSuggestionResource::collection($propositions);
    }
}
