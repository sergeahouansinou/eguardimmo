<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Resources;

use App\Modules\Privacy\Models\PrivacyRequestForward;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ce que l'organisation lit d'une demande transmise : qui, quoi, pour quand. L'identifiant est celui de la transmission, jamais celui de la demande.
 *
 * @mixin PrivacyRequestForward
 */
final class OrganizationPrivacyRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->privacyRequest->kind->value,
            'requester' => ['name' => $this->requester_name, 'email' => $this->requester_email],
            'deadline' => $this->privacyRequest->effectiveDueAt()->toIso8601String(),
            'forwarded_at' => $this->forwarded_at->toIso8601String(),
            'handled' => $this->handled_at !== null,
            'handled_at' => $this->handled_at?->toIso8601String(),
        ];
    }
}
