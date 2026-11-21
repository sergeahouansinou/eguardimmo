<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources\Console;

use App\Modules\Identity\Models\Operator;
use App\Modules\Identity\Models\OperatorRoleAssignment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Operator
 */
final class OperatorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $compte = $this->user;

        return [
            'id' => $this->user_id,
            'name' => $compte?->name,
            'email' => $compte?->email,
            'roles' => $this->roles->map(fn (OperatorRoleAssignment $r): string => $r->role->value)->sort()->values()->all(),
            'two_factor_confirmed' => $compte?->hasConfirmedTwoFactor() ?? false,
            'last_login_at' => $compte?->last_login_at?->toIso8601String(),
            'state' => $this->revoked_at === null ? 'active' : 'revoked',
            'granted_at' => $this->granted_at->toIso8601String(),
        ];
    }
}
