<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Tax\Actions\GenerateMandantStatements;
use App\Modules\Tax\Http\Requests\StoreMandantStatementsRequest;
use App\Modules\Tax\Http\Resources\SummaryResource;
use App\Modules\Tax\Http\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;

final class StoreMandantStatementsController
{
    public function __invoke(StoreMandantStatementsRequest $requete, GenerateMandantStatements $generation): JsonResponse
    {
        /** @var User $user */
        $user = $requete->user();
        $resultats = $generation->handle($requete->year(), $requete->mandantIds(), IdempotencyHeader::read($requete), (string) $user->getKey());
        $cree = false;
        $rejoue = false;
        $statutErreur = null;

        $donnees = array_map(function (array $r) use (&$cree, &$rejoue, &$statutErreur, $requete): array {
            $cree = $cree || $r['outcome'] === 'created';
            $rejoue = $rejoue || $r['outcome'] === 'replayed';
            $statutErreur ??= $r['error']?->status;

            return [
                'mandant_id' => $r['mandant_id'],
                'outcome' => $r['outcome'],
                'statement' => $r['summary'] === null ? null : (new SummaryResource($r['summary']))->resolve($requete),
                'error' => $r['error'] === null ? null : ['code' => $r['error']->problemCode, 'status' => $r['error']->status, 'detail' => $r['error']->getMessage()],
            ];
        }, $resultats);

        return response()->json(['data' => $donnees], $cree ? 201 : ($rejoue ? 200 : ($statutErreur ?? 200)));
    }
}
