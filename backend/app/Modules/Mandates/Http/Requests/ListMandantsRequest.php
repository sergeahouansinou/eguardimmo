<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ListMandantsRequest extends FormRequest
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
            'after' => ['nullable', 'uuid'],
            'limit' => ['nullable', 'integer', 'between:1,200'],
        ];
    }

    public function afterPartyId(): ?string
    {
        return $this->filled('after') ? (string) $this->validated('after') : null;
    }

    public function limit(): int
    {
        return $this->integer('limit', 100);
    }
}
