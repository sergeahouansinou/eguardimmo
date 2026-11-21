<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Resources;

use App\Modules\Accounting\Data\PartyStatementData;
use App\Modules\Accounting\Data\PartyStatementLineData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Money\Money;

/**
 * Relevé du compte d'un mandant, même forme pour l'agence et pour le mandant. Jamais l'identifiant d'une écriture ni celui de sa pièce.
 *
 * @property array{statement: PartyStatementData, party_id: string, name: string, currency: string} $resource
 */
final class PartyStatementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $releve = $this->resource['statement'];
        $devise = $this->resource['currency'];
        $montant = fn (Money $m): array => ['amount' => (int) $m->getAmount(), 'currency' => $devise];

        return [
            'mandant' => ['party_id' => $this->resource['party_id'], 'name' => $this->resource['name']],
            'from' => $releve->from->toDateString(),
            'to' => $releve->to->toDateString(),
            'opening_balance' => $montant($releve->opening),
            'closing_balance' => $montant($releve->closing),
            'lines' => array_map(fn (PartyStatementLineData $l): array => [
                'date' => $l->date->toDateString(),
                'reference' => $l->reference,
                'label' => $l->label,
                'source' => $l->source->value,
                'unit_id' => $l->unitId,
                'lease_id' => $l->leaseId,
                'is_reversal' => $l->isReversal,
                'debit' => $montant($l->debit),
                'credit' => $montant($l->credit),
                'balance' => $montant($l->balance),
            ], $releve->lines),
        ];
    }
}
