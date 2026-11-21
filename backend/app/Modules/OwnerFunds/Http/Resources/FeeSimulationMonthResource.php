<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\OwnerFunds\Data\FeeAmountsData;
use App\Modules\OwnerFunds\Data\FeeSimulationMonthData;
use App\Modules\OwnerFunds\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property FeeSimulationMonthData $resource
 */
final class FeeSimulationMonthResource extends JsonResource
{
    public function __construct(FeeSimulationMonthData $ligne, private readonly string $devise)
    {
        parent::__construct($ligne);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $m = $this->resource;

        return [
            'month' => $m->month,
            'base_rent' => MoneyShape::minor($m->baseRent, $this->devise),
            'base_charges' => MoneyShape::minor($m->baseCharges, $this->devise),
            'current' => $m->current === null ? null : $this->amounts($m->current),
            'simulated' => $this->amounts($m->simulated),
            'difference' => $m->current === null ? null : [
                'fee_net' => MoneyShape::minor($m->simulated->net - $m->current->net, $this->devise),
                'fee_total' => MoneyShape::minor($m->simulated->gross - $m->current->gross, $this->devise),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function amounts(FeeAmountsData $a): array
    {
        return [
            'source' => $a->source,
            'fee_net' => MoneyShape::minor($a->net, $this->devise),
            'tax_amount' => MoneyShape::minor($a->tax, $this->devise),
            'fee_total' => MoneyShape::minor($a->gross, $this->devise),
            'minimum_applied' => $a->minimumApplied,
        ];
    }
}
