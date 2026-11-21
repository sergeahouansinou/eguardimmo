<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Resources;

use App\Modules\Payments\Enums\PaymentAccountStatus;
use App\Modules\Payments\Models\PaymentAccount;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PaymentAccount
 */
final class PaymentAccountResource extends JsonResource
{
    public function __construct($resource, private readonly ?string $onboardingUrl = null)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'provider' => $this->provider,
            'status' => $this->status->value,
            'ready' => $this->status === PaymentAccountStatus::Ready,
            'onboarded_at' => $this->onboarded_at?->toIso8601String(),
            'onboarding_url' => $this->onboardingUrl,
        ];
    }
}
