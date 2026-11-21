<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Requests;

use App\Modules\Subscriptions\Enums\SubscriptionStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListSubscriptionsRequest extends FormRequest
{
    use PaginatesWithCursor;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            ...$this->paginationRules(['id' => 'uuid']),
            'status' => ['nullable', Rule::enum(SubscriptionStatus::class)],
            'plan' => ['nullable', 'string', 'max:32', 'regex:/^[a-z0-9_-]+$/'],
            'trial_ending' => ['nullable', 'boolean'],
        ];
    }

    public function status(): ?SubscriptionStatus
    {
        return $this->filled('status') ? SubscriptionStatus::from((string) $this->string('status')) : null;
    }

    public function plan(): ?string
    {
        return $this->filled('plan') ? (string) $this->string('plan') : null;
    }

    public function trialEnding(): bool
    {
        return $this->boolean('trial_ending');
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
