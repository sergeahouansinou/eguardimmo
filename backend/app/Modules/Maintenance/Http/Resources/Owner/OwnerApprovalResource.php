<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources\Owner;

use App\Modules\Maintenance\Models\InterventionApproval;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Demande d'accord après la décision du mandant : l'état et la version à renvoyer à la décision suivante, rien d'interne.
 *
 * @property array{approval: InterventionApproval, replayed: bool} $resource
 */
final class OwnerApprovalResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $a = $this->resource['approval'];

        return [
            'id' => $a->id,
            'intervention_id' => $a->intervention_id,
            'status' => $a->status->value,
            'decided_at' => $a->decided_at?->toIso8601String(),
            'decided_via' => $a->decided_via?->value,
            'comment' => $a->decided_via?->value === 'owner_space' ? $a->comment : null,
            'lock_version' => $a->lock_version,
            'replayed' => $this->resource['replayed'],
        ];
    }
}
