<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\MatchLines;
use App\Modules\Banking\Http\Requests\MatchLineRequest;
use App\Modules\Banking\Http\Resources\BankMatchResource;
use App\Modules\Banking\Support\Actor;
use App\Modules\Banking\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;

final class MatchLineController
{
    public function __invoke(MatchLineRequest $request, string $line, MatchLines $pointage): JsonResponse
    {
        $v = $request->validated();
        $resultat = $pointage->handle(
            $line, array_values(array_map('strval', $v['line_ids'] ?? [])), array_values(array_map('strval', $v['journal_line_ids'])), (int) $v['lock_version'],
            Actor::id($request), IdempotencyHeader::read($request),
        );

        return (new BankMatchResource($resultat['match']->load('items')))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
