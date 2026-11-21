<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Resources;

use App\Modules\Charges\Http\Support\Shapes;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;
use Money\Money;

/**
 * Vue du mandant : le nom du locataire seulement, jamais ses coordonnées, ses identifiants ni la cause d'une panne.
 *
 * @property ChargeStatement $resource
 */
final class OwnerStatementResource extends JsonResource
{
    public static $wrap = 'data';

    /**
     * @param  Collection<int, ChargeStatementLine>|null  $lignes  null : liste, sans détail
     */
    public function __construct(ChargeStatement $decompte, private readonly ?Collection $lignes, private readonly ?string $agence)
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
        $instantane = $d->snapshot;
        $base = [
            'id' => $d->id,
            'number' => $d->number,
            'status' => $d->status->value,
            'agency_name' => $this->agence,
            'period' => ['start' => $instantane['period']['start'] ?? null, 'end' => $instantane['period']['end'] ?? null],
            'tenant_names' => array_values(array_map(fn (array $t): string => (string) $t['name'], $instantane['tenants'] ?? [])),
            'unit' => ['reference' => $instantane['unit']['reference'] ?? null, 'property_name' => $instantane['unit']['property_name'] ?? null],
            'share_total' => Shapes::money($d->share_total),
            'provisions_called' => Shapes::money($d->provisions_called),
            'balance' => Shapes::money($d->balance),
            'issued_at' => $d->issued_at?->toIso8601String(),
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
