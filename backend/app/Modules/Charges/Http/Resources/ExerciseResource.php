<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Resources;

use App\Modules\Charges\Http\Support\Shapes;
use App\Modules\Charges\Http\Support\StatementSummary;
use App\Modules\Charges\Models\ChargeConsumption;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeItem;
use App\Modules\Charges\Models\ChargeItemSource;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Queries\ExerciseView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Money\Money;

/**
 * @property ChargeExercise $resource
 */
final class ExerciseResource extends JsonResource
{
    public static $wrap = 'data';

    public function __construct(ChargeExercise $exercice, private readonly ?ExerciseView $vue = null)
    {
        parent::__construct($exercice);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $e = $this->resource;
        $base = [
            'id' => $e->id,
            'property_id' => $e->property_id,
            'period_start' => $e->period_start->toDateString(),
            'period_end' => $e->period_end->toDateString(),
            'status' => $e->status->value,
            'jurisdiction' => $e->jurisdiction,
            'only_lease_id' => $e->only_lease_id,
            'prescription_acknowledged' => $e->prescription_acknowledged,
            'computed_at' => $e->computed_at?->toIso8601String(),
            'issued_at' => $e->issued_at?->toIso8601String(),
            'lock_version' => $e->lock_version,
        ];

        if ($this->vue === null) {
            return $base;
        }

        $vue = $this->vue;

        return $base + [
            'items' => $vue->items->map(fn (ChargeItem $p): array => [
                'id' => $p->id, 'label' => $p->label, 'rubric' => $p->rubric, 'key_id' => $p->key_id, 'unit_id' => $p->unit_id, 'position' => $p->position,
                'amount' => Shapes::money($p->amount),
                'owner_share' => Shapes::money(new Money($vue->ownerShares[$p->id] ?? 0, $p->amount->getCurrency())),
                'sources' => array_map(fn (ChargeItemSource $s): array => [
                    'kind' => $s->source_kind->value, 'id' => $s->source_id, 'amount' => Shapes::money(new Money($s->amount, $p->amount->getCurrency())),
                ], $vue->sources[$p->id] ?? []),
                'consumptions' => array_map(fn (ChargeConsumption $c): array => ['unit_id' => $c->unit_id, 'quantity_milli' => $c->quantity_milli], $vue->consumptions[$p->id] ?? []),
            ])->values()->all(),
            'statements' => $vue->statements->map(fn (ChargeStatement $d): array => StatementSummary::of($d))->values()->all(),
        ];
    }
}
