<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Resources\Console;

use App\Modules\Privacy\Data\ConsolePrivacyRequestData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ConsolePrivacyRequestData
 */
final class ConsolePrivacyRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'channel' => $this->channel,
            'status' => $this->status,
            'received_at' => $this->receivedAt->toIso8601String(),
            'due_at' => $this->dueAt->toIso8601String(),
            'extended_until' => $this->extendedUntil?->toIso8601String(),
            'extension_reason' => $this->extensionReason,
            'deadline' => $this->deadline->toIso8601String(),
            'overdue' => $this->overdue,
            'identity_verified_by' => $this->identityVerifiedBy,
            'identity_verified_at' => $this->identityVerifiedAt?->toIso8601String(),
            'requester' => [
                'account_id' => $this->accountId,
                'name' => $this->requesterName,
                'email' => $this->requesterEmail,
            ],
            'forwards' => ['total' => $this->forwardedCount, 'handled' => $this->forwardsHandled],
            'refusal_reason' => $this->refusalReason,
            'completed_at' => $this->completedAt?->toIso8601String(),
            'export' => ['generated' => $this->exportGenerated, 'expires_at' => $this->exportExpiresAt?->toIso8601String(), 'downloaded' => $this->exportDownloaded],
            ...($this->events === null ? [] : ['events' => $this->events]),
        ];
    }
}
