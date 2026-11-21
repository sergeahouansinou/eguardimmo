<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Requests;

use App\Modules\Organizations\Enums\OrganizationKind;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListConsoleOrganizationsRequest extends FormRequest
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
            'kind' => ['nullable', Rule::enum(OrganizationKind::class)],
            'state' => ['nullable', Rule::in(['active', 'suspended'])],
            'search' => ['nullable', 'string', 'min:3', 'max:80'],
            'plan' => ['nullable', 'string', 'max:32', 'regex:/^[a-z0-9_-]+$/'],
            'subscription_status' => ['nullable', 'string', 'max:16', 'regex:/^[a-z_]+$/'],
        ];
    }

    public function kind(): ?OrganizationKind
    {
        return $this->filled('kind') ? OrganizationKind::from((string) $this->string('kind')) : null;
    }

    public function state(): ?string
    {
        return $this->filled('state') ? (string) $this->string('state') : null;
    }

    public function search(): ?string
    {
        return $this->filled('search') ? trim((string) $this->string('search')) : null;
    }

    public function plan(): ?string
    {
        return $this->filled('plan') ? (string) $this->string('plan') : null;
    }

    public function subscriptionStatus(): ?string
    {
        return $this->filled('subscription_status') ? (string) $this->string('subscription_status') : null;
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
