<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RestrictCounterpartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'days' => ['nullable', 'integer', 'min:1', 'max:30'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ];
    }

    public function days(): int
    {
        return $this->integer('days', 30);
    }

    public function reason(): string
    {
        return trim((string) $this->string('reason'));
    }
}
