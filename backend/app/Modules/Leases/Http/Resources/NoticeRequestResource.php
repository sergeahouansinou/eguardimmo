<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Models\LeaseNoticeRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue de l'équipe (owner, admin, manager) ; le justificatif se lit par `…/proof`, jamais par un identifiant de fichier.
 *
 * @mixin LeaseNoticeRequest
 */
final class NoticeRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'lease_id' => $this->lease_id,
            'party_id' => $this->party_id,
            'status' => $this->status->value,
            'reason_key' => $this->reason_key,
            'requested_departure_on' => $this->requested_departure_on->toDateString(),
            'earliest_departure_on' => $this->earliest_departure_on->toDateString(),
            'received_on' => $this->received_on?->toDateString(),
            'has_proof' => $this->proof_file_id !== null,
            'letter_document_id' => $this->letter_document_id,
            'letter_file_id' => $this->letter_file_id,
            'letter_fingerprint' => $this->letter_fingerprint,
            'forwarding_address' => $this->forwarding_address,
            'consent_version' => $this->consent_version,
            'acknowledged_by_user_id' => $this->acknowledged_by_user_id,
            'acknowledged_at' => $this->acknowledged_at?->toIso8601String(),
            'withdrawn_at' => $this->withdrawn_at?->toIso8601String(),
            'closed_outcome' => $this->closed_outcome?->value,
            'closed_at' => $this->closed_at?->toIso8601String(),
            'late_flagged_at' => $this->late_flagged_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
