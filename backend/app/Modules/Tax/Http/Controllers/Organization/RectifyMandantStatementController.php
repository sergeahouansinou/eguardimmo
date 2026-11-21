<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Tax\Actions\RectifyMandantStatement;
use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Http\Requests\RectifySummaryRequest;
use App\Modules\Tax\Http\Resources\SummaryResource;
use App\Modules\Tax\Http\Support\IdempotencyHeader;
use App\Modules\Tax\Queries\Summaries;
use Illuminate\Http\JsonResponse;

final class RectifyMandantStatementController
{
    public function __invoke(string $statement, RectifySummaryRequest $requete, Summaries $syntheses, RectifyMandantStatement $rectification): JsonResponse
    {
        /** @var User $user */
        $user = $requete->user();
        $resultat = $rectification->handle($syntheses->find($statement, SummaryScope::Mandant), $requete->reason(), $requete->lockVersion(), IdempotencyHeader::read($requete), (string) $user->getKey());

        return (new SummaryResource($resultat['summary'], true))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
