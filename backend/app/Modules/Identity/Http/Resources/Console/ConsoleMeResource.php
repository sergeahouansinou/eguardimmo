<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources\Console;

use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
final class ConsoleMeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified_at' => $this->email_verified_at?->toIso8601String(),
            'phone' => $this->phone,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'previous_login_at' => $this->previous_login_at?->toIso8601String(),
            'roles' => collect($this->operatorRoles())->map(fn (OperatorRole $r): string => $r->value)->sort()->values()->all(),
        ];
    }
}
