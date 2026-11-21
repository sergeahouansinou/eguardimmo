<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources\Tenant;

use App\Modules\Leases\Data\NoticeReason;
use App\Modules\Leases\Support\NoticeOptionsView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin NoticeOptionsView
 */
final class TenantNoticeOptionsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'available' => $this->available,
            'unavailable_reason' => $this->unavailableReason,
            'reasons' => array_map(fn (NoticeReason $motif): array => [
                'key' => $motif->key,
                'label' => $motif->label,
                'months' => $motif->months,
                'proof_required' => $motif->proofRequired,
                'earliest_departure_on' => $this->earliest[$motif->key]->toDateString(),
            ], $this->reasons),
            'consent' => ['version' => $this->consentVersion, 'text' => $this->consentText],
            'legal_notice' => $this->legalNotice,
            'to_confirm' => $this->toConfirm,
        ];
    }
}
