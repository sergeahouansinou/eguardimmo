<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources\Tenant;

use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * La demande de congé du locataire : jamais l'identifiant de sa fiche, du justificatif ni du fichier de la lettre. `acknowledgement_overdue`
 * invite à envoyer la lettre en recommandé.
 *
 * @mixin LeaseNoticeRequest
 */
final class TenantNoticeRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'lease_id' => $this->lease_id,
            'status' => $this->status->value,
            'reason_key' => $this->reason_key,
            'requested_departure_on' => $this->requested_departure_on->toDateString(),
            'earliest_departure_on' => $this->earliest_departure_on->toDateString(),
            'departure_is_indicative' => $this->received_on === null,
            'received_on' => $this->received_on?->toDateString(),
            'has_proof' => $this->proof_file_id !== null,
            'has_letter' => $this->letter_file_id !== null,
            'forwarding_address' => $this->forwarding_address,
            'acknowledgement_overdue' => $this->status === NoticeRequestStatus::Submitted && $this->late_flagged_at !== null,
            'closed_outcome' => $this->closed_outcome?->value,
            'created_at' => $this->created_at->toIso8601String(),
            'acknowledged_at' => $this->acknowledged_at?->toIso8601String(),
            'withdrawn_at' => $this->withdrawn_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
        ];
    }
}
