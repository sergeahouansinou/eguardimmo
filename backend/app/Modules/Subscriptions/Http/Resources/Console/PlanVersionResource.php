<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Resources\Console;

use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Models\PlanEntitlement;
use App\Modules\Subscriptions\Models\PlanPrice;
use App\Modules\Subscriptions\Models\PlanVersion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PlanVersion
 */
final class PlanVersionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'plan' => $this->whenLoaded('plan', fn (): string => $this->plan->code),
            'version' => $this->version,
            'status' => $this->status->value,
            'trial_days' => $this->trial_days,
            'public_signup' => $this->public_signup,
            'published_at' => $this->published_at?->toIso8601String(),
            'archived_at' => $this->archived_at?->toIso8601String(),
            'prices' => $this->prices->sortBy('currency')->map(fn (PlanPrice $p): array => [
                'currency' => $p->currency,
                'monthly_amount' => $p->monthly_amount,
                'yearly_amount' => $p->yearly_amount,
            ])->values()->all(),
            'entitlements' => $this->entitlements->map(fn (PlanEntitlement $e): ?array => ($f = Feature::tryFrom($e->feature_key)) === null ? null : [
                'feature' => $f->value,
                'label' => $f->label(),
                'group' => $f->group(),
                'kind' => $f->isQuota() ? 'quota' : 'function',
                'enabled' => $e->enabled,
                'limit' => $e->limit_value,
            ])->filter()->sortBy('feature')->values()->all(),
        ];
    }
}
