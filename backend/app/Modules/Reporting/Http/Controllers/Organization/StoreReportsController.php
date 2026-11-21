<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Actions\CreateReports;
use App\Modules\Reporting\Http\Requests\StoreReportsRequest;
use App\Modules\Reporting\Http\Resources\ManagementReportResource;
use App\Modules\Reporting\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class StoreReportsController
{
    public function __invoke(StoreReportsRequest $request, CreateReports $creation): JsonResponse
    {
        $cle = IdempotencyHeader::read($request);
        $utilisateur = $request->user();
        $resultats = $creation->handle($request->toData(), $cle, $utilisateur === null ? null : (string) $utilisateur->getKey(), CarbonImmutable::today());
        $cree = false;
        $rejoue = false;
        $statutErreur = null;

        $donnees = array_map(function (array $r) use (&$cree, &$rejoue, &$statutErreur, $request): array {
            $cree = $cree || $r['outcome'] === 'created';
            $rejoue = $rejoue || $r['outcome'] === 'replayed';
            $statutErreur ??= $r['error']?->status;

            return [
                'mandant_id' => $r['mandant_id'],
                'outcome' => $r['outcome'],
                'report' => $r['report'] === null ? null : (new ManagementReportResource($r['report']))->resolve($request),
                'error' => $r['error'] === null ? null : ['code' => $r['error']->problemCode, 'status' => $r['error']->status, 'detail' => $r['error']->getMessage()],
            ];
        }, $resultats);

        return response()->json(['data' => $donnees], $cree ? 201 : ($rejoue ? 200 : ($statutErreur ?? 200)));
    }
}
