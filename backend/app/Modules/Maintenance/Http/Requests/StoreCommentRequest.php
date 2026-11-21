<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreCommentRequest extends FormRequest
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
        return [
            'text' => ['required', 'string', 'min:1', 'max:500'],
            'visible_to_tenant' => ['nullable', 'boolean'],
            'visible_to_owner' => ['nullable', 'boolean'],
        ];
    }

    public function text(): string
    {
        return trim((string) $this->validated('text'));
    }

    public function visibleToTenant(): bool
    {
        return (bool) ($this->validated('visible_to_tenant') ?? false);
    }

    public function visibleToOwner(): bool
    {
        return (bool) ($this->validated('visible_to_owner') ?? false);
    }
}
