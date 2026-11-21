<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources\Console;

use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\SupportAccessGrant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Accès du support à une organisation, vu de la console : le motif n'est pas servi au rôle `billing`.
 *
 * @property SupportAccessGrant $resource
 */
final class OrganizationSupportAccessResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $acces = $this->resource;
        $user = $request->user();
        $motifVisible = $user instanceof User && array_filter($user->operatorRoles(), fn (OperatorRole $role): bool => $role !== OperatorRole::Billing && $role !== OperatorRole::Engineering) !== [];

        return [
            'id' => $acces->id,
            'kind' => $acces->kind->value,
            'status' => $acces->status->value,
            'scopes' => $acces->scopes,
            'reason' => $motifVisible ? $acces->reason : null,
            'duration_hours' => $acces->duration_hours,
            'operator' => ['id' => $acces->operator_user_id, 'name' => $acces->operator->name],
            'requested_at' => $acces->requested_at?->toIso8601String(),
            'granted_at' => $acces->granted_at?->toIso8601String(),
            'expires_at' => $acces->expires_at?->toIso8601String(),
            'revoked_at' => $acces->revoked_at?->toIso8601String(),
            'reviewed' => $acces->reviewed_at !== null,
            'read_count' => $acces->read_count,
        ];
    }
}
