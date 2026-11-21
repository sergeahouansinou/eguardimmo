<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Resources;

use App\Modules\Recovery\Enums\ItemType;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Modules\Recovery\Support\ApiShapes;
use App\Modules\Recovery\Support\CaseView;
use App\Modules\Recovery\Support\Currencies;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Money\Money;

/**
 * @property RecoveryCase $resource
 */
final class CaseResource extends JsonResource
{
    public function __construct(RecoveryCase $dossier, private readonly CaseView $vue, private readonly bool $detailed = false)
    {
        parent::__construct($dossier);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $d = $this->resource;
        $ouvertes = $d->items->whereNull('removed_at');
        $du = new Money(0, Currencies::of($d->currency));

        foreach ($ouvertes as $ligne) {
            $reste = $this->vue->outstanding[$ligne->item_id] ?? null;

            if ($reste !== null && $reste->isPositive()) {
                $du = $du->add($reste);
            }
        }

        return [
            'id' => $d->id,
            'number' => $d->number,
            'status' => $d->status->value,
            'lease' => ['id' => $d->lease_id, 'reference' => ($this->vue->leases[$d->lease_id] ?? null)?->reference],
            'debtor' => ['id' => $d->debtor_party_id, 'name' => ($this->vue->parties[$d->debtor_party_id] ?? null)?->displayName],
            'currency' => $d->currency,
            'opened_on' => $d->opened_on->toDateString(),
            'closed_on' => $d->closed_on?->toDateString(),
            'status_reason' => $d->status_reason,
            'items_count' => $ouvertes->count(),
            'outstanding' => ApiShapes::money($du),
            'items' => $this->when($this->detailed, fn (): array => $d->items->map(fn (RecoveryCaseItem $l): array => $this->item($l))->values()->all()),
            'bundles' => $this->when($this->detailed && $d->relationLoaded('bundles'), fn (): array => $d->bundles->map(fn (RecoveryBundle $b): array => [
                'id' => $b->id,
                'number' => $b->number,
                'generated_on' => $b->generated_on->toDateString(),
                'total_due' => ApiShapes::money($b->total_due),
                'pieces_count' => count($b->pieces),
                'transmissions_count' => $b->relationLoaded('transmissions') ? $b->transmissions->count() : null,
            ])->all()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function item(RecoveryCaseItem $l): array
    {
        $facture = $l->item_type === ItemType::Invoice;

        return [
            'id' => $l->id,
            'type' => $l->item_type->value,
            'item_id' => $l->item_id,
            'installment_id' => $facture ? null : $l->item_id,
            'invoice_id' => $facture ? $l->item_id : null,
            'reference' => $l->reference,
            'period' => $facture ? null : ['start' => $l->period_start->toDateString(), 'end' => $l->period_end->toDateString()],
            'issued_on' => $facture ? $l->period_start->toDateString() : null,
            'due_date' => $l->due_date->toDateString(),
            'total' => ApiShapes::money($l->total_amount),
            'amount_due_at_inclusion' => ApiShapes::money($l->amount_due),
            'outstanding' => $l->removed_at === null && isset($this->vue->outstanding[$l->item_id]) ? ApiShapes::money($this->vue->outstanding[$l->item_id]) : null,
            'included_at' => $l->included_at->toIso8601String(),
            'removed_at' => $l->removed_at?->toIso8601String(),
        ];
    }
}
