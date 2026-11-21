<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Resources;

use App\Modules\Charges\Http\Support\Shapes;
use App\Modules\Charges\Http\Support\StatementSummary;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementFile;
use App\Modules\Charges\Models\ChargeStatementLine;
use App\Modules\Charges\Models\ChargeStatementPlan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;
use Money\Money;

/**
 * @property ChargeStatement $resource
 */
final class StatementResource extends JsonResource
{
    public static $wrap = 'data';

    /**
     * @param  Collection<int, ChargeStatementLine>  $lignes
     * @param  Collection<int, ChargeStatementFile>  $pieces
     */
    public function __construct(ChargeStatement $decompte, private readonly Collection $lignes, private readonly Collection $pieces, private readonly ?ChargeStatementPlan $plan)
    {
        parent::__construct($decompte);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $d = $this->resource;
        $devise = $d->share_total->getCurrency();

        return [...StatementSummary::of($d),
            'settlement' => $this->plan !== null ? 'plan_12' : $d->settlement?->value,
            'plan' => $this->plan === null ? null : ['id' => $this->plan->id, 'reason' => $this->plan->reason, 'recorded_at' => $this->plan->created_at?->toIso8601String()],
            'lines' => array_values($this->lignes->map(fn (ChargeStatementLine $l): array => [
                'item_id' => $l->item_id, 'label' => $l->label, 'rubric' => $l->rubric, 'split_label' => $l->split_label,
                'item_amount' => Shapes::money(new Money($l->item_amount, $devise)), 'weight' => $l->weight, 'denominator' => $l->denominator,
                'days' => $l->days, 'share' => Shapes::money(new Money($l->share, $devise)),
            ])->all()),
            'files' => array_values($this->pieces->map(fn (ChargeStatementFile $f): array => [
                'id' => $f->id, 'label' => $f->label, 'tenant_visible' => $f->tenant_visible, 'visible_until' => $f->visible_until?->toDateString(),
            ])->all()),
        ];
    }
}
