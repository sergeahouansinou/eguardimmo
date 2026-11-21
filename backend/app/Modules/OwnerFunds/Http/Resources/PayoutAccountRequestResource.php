<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Resources;

use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Modules\Parties\Data\BankAccountStateData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue de l'agence : quatre derniers caractères et titulaire saisi, jamais l'IBAN complet ni le code.
 *
 * @property array{request: PayoutAccountRequest, account: BankAccountStateData|null} $resource
 */
final class PayoutAccountRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $demande = $this->resource['request'];
        $compte = $this->resource['account'];

        return [
            'id' => $demande->id,
            'mandant_party_id' => $demande->mandant_party_id,
            'status' => $demande->status->value,
            'bank_account_id' => $demande->bank_account_id,
            'bank_last4' => $compte?->last4,
            'holder_name' => $compte?->holderName,
            'proof_file_id' => $demande->proof_file_id,
            'requested_by_user_id' => $demande->requested_by_user_id,
            'decided_by_user_id' => $demande->decided_by_user_id,
            'decided_at' => $demande->decided_at?->toIso8601String(),
            'reject_reason' => $demande->reject_reason,
            'lock_version' => $demande->lock_version,
            'created_at' => $demande->created_at?->toIso8601String(),
        ];
    }
}
