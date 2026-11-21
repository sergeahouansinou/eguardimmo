<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Resources;

use App\Modules\Charges\Http\Support\Shapes;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementFile;
use App\Modules\Charges\Models\ChargeStatementLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;
use Money\Money;

/**
 * Vue du locataire : ni mandant, ni mandat, ni empreinte, ni instantané, ni cause de panne.
 *
 * @property ChargeStatement $resource
 */
final class TenantStatementResource extends JsonResource
{
    public static $wrap = 'data';

    /**
     * @param  Collection<int, ChargeStatementLine>|null  $lignes  null : liste, sans détail
     * @param  Collection<int, ChargeStatementFile>  $pieces
     */
    public function __construct(ChargeStatement $decompte, private readonly ?Collection $lignes, private readonly Collection $pieces, private readonly bool $etale)
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
        $base = [
            'id' => $d->id,
            'lease_id' => $d->lease_id,
            'number' => $d->number,
            'status' => $d->status->value,
            'period' => ['start' => $d->snapshot['period']['start'] ?? null, 'end' => $d->snapshot['period']['end'] ?? null],
            'occupied_days' => $d->occupied_days,
            'share_total' => Shapes::money($d->share_total),
            'provisions_called' => Shapes::money($d->provisions_called),
            'balance' => Shapes::money($d->balance),
            'suggested_monthly_provision' => Shapes::money($d->suggested_monthly_provision),
            'settlement' => $this->etale ? 'plan_12' : $d->settlement?->value,
            'not_before' => $d->not_before?->toDateString(),
            'issued_at' => $d->issued_at?->toIso8601String(),
            'files' => array_values($this->pieces->where('statement_id', $d->id)->map(fn (ChargeStatementFile $f): array => ['id' => $f->id, 'label' => $f->label, 'visible_until' => $f->visible_until?->toDateString()])->all()),
        ];

        if ($this->lignes === null) {
            return $base;
        }

        return [...$base, 'lines' => array_values($this->lignes->where('statement_id', $d->id)->map(fn (ChargeStatementLine $l): array => [
            'label' => $l->label, 'split_label' => $l->split_label, 'item_amount' => Shapes::money(new Money($l->item_amount, $devise)),
            'days' => $l->days, 'share' => Shapes::money(new Money($l->share, $devise)),
        ])->all())];
    }
}
