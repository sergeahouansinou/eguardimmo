<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use App\Modules\Parties\Models\BankAccount;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * L'IBAN complet n'est jamais renvoyé : quatre derniers chiffres seulement.
 *
 * @property BankAccount $resource
 */
final class BankAccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'iban_last4' => $this->resource->iban_last4,
            'bic' => $this->resource->bic,
            'holder_name' => $this->resource->holder_name,
            'valid_from' => $this->resource->valid_from->toDateString(),
            'valid_to' => $this->resource->valid_to?->toDateString(),
            'is_active' => $this->resource->valid_to === null,
        ];
    }
}
