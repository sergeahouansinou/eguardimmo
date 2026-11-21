<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class OrganizationFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return ['organization' => ['nullable', 'uuid']];
    }

    public function organizationId(): ?string
    {
        return $this->filled('organization') ? strtolower((string) $this->validated('organization')) : null;
    }
}
