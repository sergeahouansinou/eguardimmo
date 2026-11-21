<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources\Console;

use App\Modules\Organizations\Data\TeamMemberData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Périmètre `team` : prénom, nom et rôle seulement, jamais d'adresse, de 2FA ni d'identifiant de compte.
 *
 * @property TeamMemberData $resource
 */
final class OrganizationTeamResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'first_name' => $this->resource->firstName,
            'last_name' => $this->resource->lastName,
            'role' => $this->resource->role->value,
        ];
    }
}
