<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Data\FeeSimulationMonthData;
use App\Modules\OwnerFunds\Http\Requests\SimulateFeesRequest;
use App\Modules\OwnerFunds\Http\Resources\FeeSimulationMonthResource;
use App\Modules\OwnerFunds\Support\FeeSimulator;
use App\Modules\OwnerFunds\Support\MoneyShape;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class SimulateFeesController
{
    /**
     * Simulation en lecture seule : aucune écriture, aucune facture, aucun relevé.
     */
    public function __invoke(SimulateFeesRequest $request, FeeSimulator $simulateur, OrganizationDirectory $organisations): JsonResponse
    {
        $proposition = $request->proposal();
        $devise = $organisations->currency()->getCode();
        $lignes = $simulateur->simulate($request->mandateId(), $proposition, $request->months(), CarbonImmutable::today());
        $meta = [
            'mandate_id' => $request->mandateId(),
            'months_requested' => $request->months(),
            'months_returned' => count($lignes),
            'currency' => $devise,
        ];

        if ($lignes === []) {
            return response()->json(['data' => [], 'meta' => [...$meta, 'reason' => 'no_closed_period', 'totals' => null]]);
        }

        $actuels = array_filter($lignes, fn (FeeSimulationMonthData $l): bool => $l->current !== null);
        $complet = count($actuels) === count($lignes);
        $net = array_sum(array_map(fn (FeeSimulationMonthData $l): int => $l->simulated->net, $lignes));
        $brut = array_sum(array_map(fn (FeeSimulationMonthData $l): int => $l->simulated->gross, $lignes));
        $netActuel = array_sum(array_map(fn (FeeSimulationMonthData $l): int => $l->current->net ?? 0, $lignes));
        $brutActuel = array_sum(array_map(fn (FeeSimulationMonthData $l): int => $l->current->gross ?? 0, $lignes));

        return response()->json([
            'data' => array_map(fn (FeeSimulationMonthData $l): array => (new FeeSimulationMonthResource($l, $devise))->resolve(), $lignes),
            'meta' => [...$meta, 'reason' => null, 'totals' => [
                'simulated_fee_net' => MoneyShape::minor($net, $devise),
                'simulated_fee_total' => MoneyShape::minor($brut, $devise),
                'current_fee_net' => $complet ? MoneyShape::minor($netActuel, $devise) : null,
                'current_fee_total' => $complet ? MoneyShape::minor($brutActuel, $devise) : null,
                'difference_fee_net' => $complet ? MoneyShape::minor($net - $netActuel, $devise) : null,
                'difference_fee_total' => $complet ? MoneyShape::minor($brut - $brutActuel, $devise) : null,
            ]],
        ]);
    }
}
