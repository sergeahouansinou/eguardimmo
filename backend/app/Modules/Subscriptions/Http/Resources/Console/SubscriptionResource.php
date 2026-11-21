<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Resources\Console;

use App\Modules\Subscriptions\Models\Subscription;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Subscription
 */
final class SubscriptionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'plan' => $this->planVersion->plan->code,
            'plan_version' => $this->planVersion->version,
            'status' => $this->status->value,
            'currency' => $this->currency,
            'trial_ends_at' => $this->trial_ends_at?->toIso8601String(),
            'current_period_end' => $this->current_period_end?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
