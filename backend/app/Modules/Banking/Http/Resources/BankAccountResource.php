<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Resources;

use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\MoneyShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Jamais l'IBAN ni son empreinte : quatre derniers caractères seulement.
 *
 * @property OrganizationBankAccount $resource
 */
final class BankAccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $r = $this->resource;
        $dernier = $r->getAttributes()['last_reconciled_on'] ?? null;

        return [
            'id' => $r->id,
            'ledger_role' => $r->ledger_role->value,
            'label' => $r->label,
            'bank_name' => $r->bank_name,
            'holder_name' => $r->holder_name,
            'identifier_kind' => $r->identifier_kind->value,
            'last4' => $r->identifier_last4,
            'country' => $r->country,
            'currency' => $r->currency,
            'status' => $r->status->value,
            'reconciliation_from' => $r->reconciliation_from->toDateString(),
            'opening_bank_balance' => MoneyShape::of($r->opening_bank_balance),
            'replaces_id' => $r->replaces_id,
            'csv_profile' => $r->csv_profile,
            'last_reconciled_on' => is_string($dernier) ? substr($dernier, 0, 10) : null,
            'closed_at' => $r->closed_at?->toIso8601String(),
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }
}
