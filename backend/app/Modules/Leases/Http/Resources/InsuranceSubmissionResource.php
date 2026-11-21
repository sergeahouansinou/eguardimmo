<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Vue de l'équipe ; `stored_file_id` se lit par le téléchargement de fichier de l'organisation.
 *
 * @mixin LeaseInsuranceSubmission
 */
final class InsuranceSubmissionResource extends JsonResource
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
            'stored_file_id' => $this->stored_file_id,
            'insurer' => $this->insurer,
            'policy_number' => $this->policy_number,
            'starts_on' => $this->starts_on->toDateString(),
            'ends_on' => $this->ends_on->toDateString(),
            'status' => $this->status->value,
            'rejection_reason' => $this->rejection_reason?->value,
            'note' => $this->note,
            'decided_by_user_id' => $this->decided_by_user_id,
            'decided_at' => $this->decided_at?->toIso8601String(),
            'certificate_id' => $this->certificate_id,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
