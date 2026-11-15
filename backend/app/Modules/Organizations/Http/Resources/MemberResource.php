<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Resources;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Models\OrganizationMember;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property OrganizationMember $resource
 */
final class MemberResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $membre = $this->resource;
        $compte = $membre->user;

        return [
            'id' => $membre->id,
            'first_name' => $membre->first_name,
            'last_name' => $membre->last_name,
            'email' => $membre->email,
            'role' => $membre->role->value,
            'status' => $membre->status->value,
            'scope' => [
                'type' => $membre->scope_type->value,
                'property_ids' => $membre->scope_property_ids ?? [],
            ],
            'two_factor' => $this->deuxFacteurs($compte),
            'last_login_at' => $compte?->last_login_at?->toIso8601String(),
            'invited_at' => $membre->invited_at?->toIso8601String(),
            'joined_at' => $membre->joined_at?->toIso8601String(),
            'message' => $membre->message,
            'self' => $compte !== null && $compte->id === $request->user()?->getAuthIdentifier(),
        ];
    }

    private function deuxFacteurs(?User $compte): string
    {
        if ($compte === null) {
            return 'pending';
        }

        return $compte->hasConfirmedTwoFactor() ? 'enabled' : 'disabled';
    }
}
