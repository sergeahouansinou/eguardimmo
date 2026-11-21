<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\AcceptSuggestions;
use App\Modules\Banking\Http\Requests\AcceptSuggestionsRequest;
use App\Modules\Banking\Support\Actor;
use App\Modules\Banking\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;

final class AcceptSuggestionsController
{
    public function __invoke(AcceptSuggestionsRequest $request, AcceptSuggestions $validation): JsonResponse
    {
        $resultat = $validation->handle(array_values(array_map('strval', $request->validated('suggestion_ids'))), Actor::id($request), IdempotencyHeader::read($request));

        return response()->json(['data' => ['accepted' => $resultat['accepted'], 'skipped' => $resultat['skipped'], 'replayed' => $resultat['replayed']]]);
    }
}
