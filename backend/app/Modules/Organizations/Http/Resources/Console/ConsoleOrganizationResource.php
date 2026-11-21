<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Resources\Console;

use App\Modules\Organizations\Data\ConsoleOrganizationData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ConsoleOrganizationData
 */
final class ConsoleOrganizationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'kind' => $this->kind,
            'country' => $this->country,
            'created_at' => $this->createdAt->toIso8601String(),
            'state' => $this->suspendedAt === null ? 'active' : 'suspended',
            'suspension' => $this->suspendedAt === null ? null : [
                'suspended_at' => $this->suspendedAt->toIso8601String(),
                'reason' => $this->suspensionReason,
            ],
            'members_count' => $this->membersCount,
            'plan' => $this->plan,
            'subscription_status' => $this->subscriptionStatus,
            ...($this->detailed ? [
                'two_factor_required' => $this->twoFactorRequired,
                'owner' => $this->owner,
            ] : []),
        ];
    }
}
