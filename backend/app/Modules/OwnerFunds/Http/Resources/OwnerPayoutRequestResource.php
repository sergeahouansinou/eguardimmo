<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\Parties\Data\BankAccountStateData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ce que le mandant voit de sa demande : jamais l'IBAN, le code, le motif de refus ni la pièce.
 *
 * @property array{request: PayoutAccountRequest, account: BankAccountStateData|null} $resource
 */
final class OwnerPayoutRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $demande = $this->resource['request'];
        $compte = $this->resource['account'];
        $attente = $demande->status === PayoutAccountRequestStatus::AwaitingCode;

        return [
            'id' => $demande->id,
            'access_id' => $demande->access_id,
            'status' => $demande->status->value,
            'bank_last4' => $compte?->last4,
            'holder_name' => $compte?->holderName,
            'requested_at' => $demande->created_at?->toIso8601String(),
            'code_expires_at' => $attente ? $demande->created_at?->copy()->addMinutes((int) config('owner_funds.payout_code_minutes'))->toIso8601String() : null,
            'decided_at' => $demande->decided_at?->toIso8601String(),
        ];
    }
}
