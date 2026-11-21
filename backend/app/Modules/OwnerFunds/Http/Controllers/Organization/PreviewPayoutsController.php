<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Http\Requests\PreviewPayoutsRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutEvaluationResource;
use App\Modules\OwnerFunds\Support\PayoutEvaluator;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class PreviewPayoutsController
{
    /**
     * Aperçu serveur : les mandants au compte créditeur, du plus gros solde au plus petit, dans la limite demandée (au plus
     * la taille d'un lot) : chaque mandant coûte une évaluation complète.
     */
    public function __invoke(PreviewPayoutsRequest $request, LedgerAggregates $agregats, PayoutEvaluator $evaluateur, OrganizationDirectory $organisations): JsonResponse
    {
        $devise = $organisations->currency();
        $aujourdhui = CarbonImmutable::today();
        $comptes = array_filter($agregats->allOwnerFunds($devise, $aujourdhui), fn ($f): bool => $f->payable->isPositive());
        uasort($comptes, fn ($a, $b): int => (int) $b->payable->getAmount() <=> (int) $a->payable->getAmount());
        $lignes = [];

        foreach (array_slice(array_keys($comptes), 0, $request->limit()) as $mandantId) {
            $lignes[] = (new PayoutEvaluationResource($evaluateur->evaluate((string) $mandantId, $aujourdhui), $devise->getCode()))->resolve();
        }

        return response()->json(['data' => $lignes, 'meta' => ['limit' => $request->limit(), 'truncated' => count($comptes) > $request->limit()]]);
    }
}
