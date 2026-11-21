<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreTenantCommentRequest extends FormRequest
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
        ];
    }

    public function text(): string
    {
        return trim((string) $this->validated('text'));
    }
}
