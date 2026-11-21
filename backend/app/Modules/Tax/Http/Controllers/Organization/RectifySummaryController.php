<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Tax\Actions\RectifyTaxSummary;
use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Http\Requests\RectifySummaryRequest;
use App\Modules\Tax\Http\Resources\SummaryResource;
use App\Modules\Tax\Http\Support\IdempotencyHeader;
use App\Modules\Tax\Queries\Summaries;
use Illuminate\Http\JsonResponse;

final class RectifySummaryController
{
    public function __invoke(string $summary, RectifySummaryRequest $requete, Summaries $syntheses, RectifyTaxSummary $rectification): JsonResponse
    {
        /** @var User $user */
        $user = $requete->user();
        $original = $syntheses->find($summary, SummaryScope::Organization);
        $resultat = $rectification->handle($original, $requete->reason(), $requete->lockVersion(), IdempotencyHeader::read($requete), (string) $user->getKey());

        return (new SummaryResource($resultat['summary'], true))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
