<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ResendRequest extends FormRequest
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
        return ['valid_days' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('recovery.transmission.max_days')]];
    }

    public function validDays(): ?int
    {
        return $this->filled('valid_days') ? $this->integer('valid_days') : null;
    }
}
