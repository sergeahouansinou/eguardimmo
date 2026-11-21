<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\RentAdjustment;

final class AdjustmentEffects
{
    private const int LOT = 500;

    /**
     * @param  list<string>  $statementIds
     * @return list<string> décomptes qui ont une ligne de régularisation ou un crédit
     */
    public function ofStatements(array $statementIds): array
    {
        $trouves = [];

        foreach (array_chunk($statementIds, self::LOT) as $lot) {
            foreach (RentAdjustment::query()->where('source_type', 'charge_statement')->whereIn('source_id', $lot)->pluck('source_id') as $id) {
                $trouves[(string) $id] = true;
            }

            $cles = array_map(fn (string $id): string => "charges:statement:{$id}:credit", $lot);

            foreach (Payment::query()->whereIn('idempotency_key', $cles)->pluck('idempotency_key') as $cle) {
                $trouves[explode(':', (string) $cle)[2]] = true;
            }
        }

        return array_keys($trouves);
    }
}
