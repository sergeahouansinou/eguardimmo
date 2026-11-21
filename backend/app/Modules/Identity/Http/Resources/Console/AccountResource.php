<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources\Console;

use App\Modules\Identity\Data\AccountFileData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AccountFileData
 */
final class AccountResource extends JsonResource
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
            'created_at' => $this->createdAt?->toIso8601String(),
            'email_verified' => $this->emailVerifiedAt !== null,
            'last_login_at' => $this->lastLoginAt?->toIso8601String(),
            'deleted' => $this->deletedAt !== null,
            'deleted_at' => $this->deletedAt?->toIso8601String(),
            'is_operator' => $this->isOperator,
            'suspension' => $this->suspendedAt === null ? null : [
                'suspended_at' => $this->suspendedAt->toIso8601String(),
                'reason' => $this->suspensionReason,
                'reviewed' => $this->suspensionReviewedAt !== null,
                'reviewed_at' => $this->suspensionReviewedAt?->toIso8601String(),
            ],
            'two_factor' => [
                'enabled' => $this->twoFactorEnabled,
                'recovery_codes_remaining' => $this->recoveryCodesRemaining,
            ],
            'devices_count' => $this->devicesCount,
            'tokens_count' => $this->tokensCount,
            'profile_types' => $this->profileTypes,
            'organizations_count' => $this->organizationsCount,
        ];
    }
}
