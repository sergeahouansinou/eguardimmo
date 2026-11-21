<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources\Tenant;

use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Le locataire retrouve son propre dépôt ; jamais l'identifiant de sa fiche ni celui du fichier.
 *
 * @mixin LeaseInsuranceSubmission
 */
final class TenantInsuranceSubmissionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'insurer' => $this->insurer,
            'policy_number' => $this->policy_number,
            'starts_on' => $this->starts_on->toDateString(),
            'ends_on' => $this->ends_on->toDateString(),
            'rejection_reason' => $this->rejection_reason?->value,
            'note' => $this->note,
            'created_at' => $this->created_at->toIso8601String(),
            'decided_at' => $this->decided_at?->toIso8601String(),
        ];
    }
}
