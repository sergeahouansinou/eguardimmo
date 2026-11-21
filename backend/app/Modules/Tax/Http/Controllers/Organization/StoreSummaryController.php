<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Tax\Actions\FinalizeTaxSummary;
use App\Modules\Tax\Http\Requests\StoreSummaryRequest;
use App\Modules\Tax\Http\Resources\SummaryResource;
use App\Modules\Tax\Http\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;

final class StoreSummaryController
{
    public function __invoke(StoreSummaryRequest $requete, FinalizeTaxSummary $finalisation): JsonResponse
    {
        /** @var User $user */
        $user = $requete->user();
        $resultat = $finalisation->handle($requete->year(), $requete->householdComplete(), IdempotencyHeader::read($requete), (string) $user->getKey());

        return (new SummaryResource($resultat['summary'], true))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
