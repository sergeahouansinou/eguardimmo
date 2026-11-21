<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources\Console;

use App\Modules\Identity\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
final class AccountSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->trashed() ? null : $this->email,
            'deleted' => $this->trashed(),
            'suspended' => $this->isSuspended(),
            'is_operator' => $this->isActiveOperator(),
        ];
    }
}
